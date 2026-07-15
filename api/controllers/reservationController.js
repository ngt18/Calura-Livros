// ================================================================
//  reservationController - Regras de reserva/empréstimo de livros
//  Controla todo o ciclo de vida de uma reserva: criar, listar,
//  atualizar status (devolver/cancelar/marcar atrasada) e excluir.
//  Também mantém livros.disponivel sincronizado com as reservas.
// ================================================================

const { pool } = require("../database/connection");
const { calcularDataPrevista, calcularStatus } = require("../services/loanCalculator");

// --- Status possíveis de uma reserva ---

// Status que "ocupam" o livro: enquanto a reserva estiver em um desses,
// o livro é considerado indisponível para novas reservas
const ACTIVE_STATUSES = ["ATIVA", "ATRASADA"];
// Todos os status válidos que uma reserva pode assumir no sistema
const VALID_STATUSES = ["ATIVA", "ATRASADA", "DEVOLVIDO", "CANCELADA"];

// Converte apelidos/variações (em inglês, minúsculas, etc.) para os
// status oficiais usados no banco (ATIVA/ATRASADA/DEVOLVIDO/CANCELADA).
// Ex.: "returned" -> "DEVOLVIDO", "cancelada" -> "CANCELADA".
// Se não reconhecer o valor recebido, apenas devolve o texto em maiúsculas.
function normalizeStatus(status, fallback = "ATIVA") {
  if (!status) return fallback;
  const statusMap = {
    active: "ATIVA",
    overdue: "ATRASADA",
    returned: "DEVOLVIDO",
    cancelled: "CANCELADA",
    cancelada: "CANCELADA",
    devolvido: "DEVOLVIDO",
    atrasada: "ATRASADA",
    ativa: "ATIVA"
  };
  const normalized = String(status).trim();
  return statusMap[normalized.toLowerCase()] || normalized.toUpperCase();
}

// Diz se um status é "ativo", ou seja, se ele mantém o livro reservado/emprestado
function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status);
}

// Recalcula se um livro está disponível, verificando se ainda existe
// alguma reserva ATIVA ou ATRASADA para ele. É chamada sempre que uma
// reserva é criada, atualizada ou excluída, para manter livros.disponivel
// sempre correto (evita que ele fique "dessincronizado" das reservas reais).
async function syncBookAvailability(connection, bookId) {
  const [activeReservations] = await connection.query(
    "SELECT id_reserva FROM reservas WHERE id_livro = ? AND status IN ('ATIVA', 'ATRASADA') LIMIT 1",
    [bookId]
  );
  await connection.query(
    "UPDATE livros SET disponivel = ? WHERE id_livro = ?",
    [activeReservations.length === 0, bookId] // disponível = true só quando NÃO há reserva ativa/atrasada
  );
}

// Recalcula o status "ao vivo" de uma reserva no momento da LEITURA,
// sem depender de um job/cron para atualizar o banco periodicamente.
// Usa o loanCalculator para verificar se uma reserva ATIVA já passou
// da data prevista e deve ser exibida como ATRASADA.
// CANCELADA e DEVOLVIDO são status finais: uma vez definidos, não são
// recalculados (a reserva nunca "volta" a ficar ATIVA/ATRASADA).
function computeStatusAuto(row) {
  if (row.status === 'CANCELADA' || row.status === 'DEVOLVIDO') return row.status;
  return calcularStatus(row.data_devolucao, row.data_prevista);
}

// --- Consultas (GET) ---

// Lista as reservas: administradores enxergam TODAS as reservas do
// sistema, enquanto um usuário comum só vê as SUAS próprias (filtro
// "WHERE r.id_usuario = ?" é aplicado apenas quando não é admin).
// O JOIN com usuarios/livros já traz nome do usuário e título/autor do
// livro na mesma consulta, evitando várias idas ao banco.
async function getReservations(req, res) {
  try {
    const isAdmin = req.user && req.user.is_admin;
    const userId = req.user ? req.user.id_usuario : null;

    let query = `
      SELECT r.*, u.nome AS usuario_nome, u.email AS usuario_email,
              l.titulo AS livro_titulo, l.autor AS livro_autor, l.paginas
       FROM reservas r
       JOIN usuarios u ON u.id_usuario = r.id_usuario
       JOIN livros l ON l.id_livro = r.id_livro
    `;
    const params = [];

    // Usuário comum: restringe a consulta apenas às reservas dele mesmo
    if (!isAdmin) {
      query += ` WHERE r.id_usuario = ?`;
      params.push(userId);
    }

    query += ` ORDER BY r.id_reserva DESC`;

    const [rows] = await pool.query(query, params);
    // Recalcula o status de cada reserva "na hora" (detecta atraso, por exemplo)
    const result = rows.map(r => ({
      ...r,
      status: computeStatusAuto(r)
    }));
    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error getting reservations" });
  }
}

// Busca uma única reserva pelo ID (ex.: para exibir uma tela de detalhes)
async function getReservationById(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }
  try {
    const [rows] = await pool.query(
      `SELECT r.*, u.nome AS usuario_nome, u.email AS usuario_email,
              l.titulo AS livro_titulo, l.autor AS livro_autor, l.paginas
       FROM reservas r
       JOIN usuarios u ON u.id_usuario = r.id_usuario
       JOIN livros l ON l.id_livro = r.id_livro
       WHERE r.id_reserva = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }
    return res.status(200).json({ ...rows[0], status: computeStatusAuto(rows[0]) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error getting reservation" });
  }
}

// --- Criação de reserva (POST) ---

// Cria uma nova reserva/empréstimo de um livro para um usuário.
//
// O que é uma TRANSAÇÃO e por que ela é usada aqui?
// Uma transação agrupa várias operações no banco (vários SELECTs, um
// INSERT, um UPDATE...) para que sejam tratadas como uma coisa só: ou
// tudo é confirmado no final (connection.commit()), ou, se algo der
// errado no meio do caminho, tudo é desfeito (connection.rollback()).
// Isso evita deixar o banco num estado inconsistente, como "reservar"
// o livro mas não conseguir gravar a linha da reserva.
//
// O que é "FOR UPDATE" e por que ele é usado aqui?
// "SELECT ... FOR UPDATE" TRAVA (bloqueia) as linhas lidas até a
// transação terminar (com commit ou rollback). Isso é essencial para
// evitar reserva duplicada: se dois usuários tentarem reservar o MESMO
// livro ao mesmo tempo (acesso concorrente), o segundo pedido precisa
// esperar o primeiro terminar sua transação, e só então vai enxergar o
// resultado atualizado. Sem o FOR UPDATE, os dois poderiam "passar"
// pela checagem de disponibilidade ao mesmo tempo e o livro acabaria
// com duas reservas ativas ao mesmo tempo.
async function createReservation(req, res) {
  const data_reserva = req.body.data_reserva || new Date().toISOString().split("T")[0];
  const id_usuario = parseInt(req.body.id_usuario, 10);
  const id_livro = parseInt(req.body.id_livro, 10);

  if (Number.isNaN(id_usuario) || Number.isNaN(id_livro)) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const connection = await pool.getConnection(); // pega uma conexão exclusiva do pool para esta transação

  try {
    await connection.beginTransaction(); // início da transação

    // Busca o livro e já TRAVA a linha (FOR UPDATE): nenhuma outra
    // transação concorrente consegue reservar este mesmo livro
    // enquanto esta aqui não terminar (commit ou rollback)
    const [book] = await connection.query(
      "SELECT * FROM livros WHERE id_livro = ? FOR UPDATE",
      [id_livro]
    );

    if (book.length === 0) {
      await connection.rollback(); // desfaz a transação: livro não existe
      return res.status(404).json({ error: "Book not found" });
    }

    const [user] = await connection.query(
      "SELECT id_usuario FROM usuarios WHERE id_usuario = ?",
      [id_usuario]
    );

    if (user.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "User not found" });
    }

    // Com o livro já travado, verifica se já existe reserva ATIVA/
    // ATRASADA para ele. Graças ao FOR UPDATE, não há risco de outra
    // requisição concorrente criar uma reserva entre esta checagem e o
    // INSERT feito mais abaixo.
    const [activeBookReservation] = await connection.query(
      "SELECT id_reserva FROM reservas WHERE id_livro = ? AND status IN ('ATIVA', 'ATRASADA') LIMIT 1 FOR UPDATE",
      [id_livro]
    );

    if (activeBookReservation.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: "Book is not available" }); // 409 = conflito, livro já reservado
    }

    // Impede que o MESMO usuário reserve o MESMO livro duas vezes
    const [activeUserReservation] = await connection.query(
      "SELECT id_reserva FROM reservas WHERE id_usuario = ? AND id_livro = ? AND status IN ('ATIVA', 'ATRASADA') LIMIT 1 FOR UPDATE",
      [id_usuario, id_livro]
    );

    if (activeUserReservation.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: "User already has an active reservation for this book" });
    }

    // Calcula a data prevista de devolução com base na quantidade de
    // páginas do livro (regra do loanCalculator / RF05)
    const data_emprestimo = data_reserva;
    const data_prevista = calcularDataPrevista(data_emprestimo, book[0].paginas);

    // Grava a reserva já nascendo com status ATIVA
    const [result] = await connection.query(
      "INSERT INTO reservas (data_reserva, data_emprestimo, data_prevista, status, id_usuario, id_livro) VALUES (?, ?, ?, ?, ?, ?)",
      [data_reserva, data_emprestimo, data_prevista, 'ATIVA', id_usuario, id_livro]
    );

    await syncBookAvailability(connection, id_livro); // livro passa a constar como indisponível
    await connection.commit(); // confirma de vez todas as alterações feitas na transação

    return res.status(201).json({
      id_reserva: result.insertId,
      id: result.insertId,
      data_reserva,
      data_emprestimo,
      data_prevista,
      data_devolucao: null,
      status: 'ATIVA',
      id_usuario,
      id_livro
    });
  } catch (error) {
    await connection.rollback(); // erro inesperado: desfaz tudo o que foi feito nesta transação
    console.error(error);
    return res.status(500).json({ error: "Error creating reservation" });
  } finally {
    connection.release(); // devolve a conexão ao pool sempre, mesmo se der erro
  }
}

// --- Atualização de reserva (PUT/PATCH) ---

// Atualiza uma reserva existente. Esta função funciona como uma
// MÁQUINA DE ESTADOS: a reserva está sempre em um status (ATIVA,
// ATRASADA, DEVOLVIDO ou CANCELADA) e aqui é decidido quais transições
// de status são permitidas e QUEM pode realizá-las:
//  - DEVOLVIDO e CANCELADA: qualquer usuário logado pode fazer (ex.: o
//    próprio usuário devolvendo ou cancelando a sua reserva).
//  - ATRASADA e a edição direta das datas (data_reserva, data_emprestimo,
//    data_prevista, data_devolucao): permitido SOMENTE para
//    administradores (devolve 403 - Forbidden - se um usuário comum tentar).
async function updateReservation(req, res) {
  const id = parseInt(req.params.id, 10);
  const isAdmin = req.user && req.user.is_admin;
  const status = req.body.status ? normalizeStatus(req.body.status) : null;

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Trava a reserva (FOR UPDATE) enquanto decide e aplica as mudanças,
    // evitando que duas atualizações concorrentes conflitem entre si
    const [existing] = await connection.query(
      "SELECT * FROM reservas WHERE id_reserva = ? FOR UPDATE",
      [id]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Reservation not found" });
    }

    const reservation = existing[0];
    const currentStatus = reservation.status;
    const updates = []; // pedaços "coluna = ?" que serão montados no UPDATE final
    const params = [];  // valores correspondentes, na mesma ordem de "updates"

    // Edição direta das datas: reservada apenas para administradores
    if (isAdmin && req.body.data_reserva !== undefined) {
      updates.push("data_reserva = ?");
      params.push(req.body.data_reserva);
    }

    if (isAdmin && req.body.data_emprestimo !== undefined) {
      updates.push("data_emprestimo = ?");
      params.push(req.body.data_emprestimo);
    }

    if (isAdmin && req.body.data_prevista !== undefined) {
      updates.push("data_prevista = ?");
      params.push(req.body.data_prevista);
    }

    if (isAdmin && req.body.data_devolucao !== undefined) {
      updates.push("data_devolucao = ?");
      params.push(req.body.data_devolucao);
    }

    // A partir daqui: as transições de status válidas (a "máquina de estados")
    if (status === 'DEVOLVIDO') {
      // Qualquer usuário logado pode marcar como devolvido, desde que a
      // reserva ainda não esteja finalizada (cancelada ou já devolvida)
      if (currentStatus === 'CANCELADA' || currentStatus === 'DEVOLVIDO') {
        await connection.rollback();
        return res.status(409).json({ error: "Reservation already returned or cancelled" });
      }
      updates.push("status = ?", "data_devolucao = ?");
      params.push('DEVOLVIDO', new Date().toISOString().split('T')[0]); // grava a data de devolução como hoje
    } else if (status === 'CANCELADA') {
      // Qualquer usuário logado pode cancelar, desde que ainda não finalizada
      if (currentStatus === 'DEVOLVIDO' || currentStatus === 'CANCELADA') {
        await connection.rollback();
        return res.status(409).json({ error: "Reservation already returned or cancelled" });
      }
      updates.push("status = ?");
      params.push('CANCELADA');
    } else if (status === 'ATRASADA') {
      // Marcar manualmente como atrasada é uma ação exclusiva de admin
      if (!isAdmin) {
        await connection.rollback();
        return res.status(403).json({ error: "Only admins can mark reservations as overdue" }); // 403 = acesso negado
      }
      // E só faz sentido marcar como atrasada uma reserva que ainda está ATIVA
      if (currentStatus !== 'ATIVA') {
        await connection.rollback();
        return res.status(409).json({ error: "Only active reservations can be marked as overdue" });
      }
      updates.push("status = ?");
      params.push('ATRASADA');
    }

    // Se nenhum campo válido foi enviado, não há o que atualizar
    if (updates.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(id);
    await connection.query(
      `UPDATE reservas SET ${updates.join(", ")} WHERE id_reserva = ?`, // monta o UPDATE dinamicamente, só com os campos alterados
      params
    );

    await syncBookAvailability(connection, reservation.id_livro); // recalcula a disponibilidade do livro após a mudança
    await connection.commit();

    const [updated] = await pool.query(
      "SELECT * FROM reservas WHERE id_reserva = ?",
      [id]
    );

    return res.json({ ...updated[0], status: computeStatusAuto(updated[0]) });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: "Error updating reservation" });
  } finally {
    connection.release();
  }
}

// --- Exclusão de reserva (DELETE) ---

// Apaga definitivamente uma reserva do banco e, em seguida, recalcula
// a disponibilidade do livro (ele pode voltar a ficar disponível).
async function deleteReservation(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.query(
      "SELECT * FROM reservas WHERE id_reserva = ? FOR UPDATE",
      [id]
    );
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Reservation not found" });
    }
    await connection.query(
      "DELETE FROM reservas WHERE id_reserva = ?",
      [id]
    );
    await syncBookAvailability(connection, existing[0].id_livro); // atualiza a disponibilidade do livro após remover a reserva
    await connection.commit();
    return res.status(204).send(); // 204 = sucesso, sem conteúdo para devolver
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: "Error deleting reservation" });
  } finally {
    connection.release();
  }
}

// Exporta os handlers para serem ligados às rotas
// (ex.: em routes/reservationRoutes.js)
module.exports = {
  getReservations,
  getReservationById,
  createReservation,
  updateReservation,
  deleteReservation
};