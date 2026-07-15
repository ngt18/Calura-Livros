// ================================================================
//  Controller de Livros
//  Concentra as regras de negócio do CRUD de livros: montar a
//  consulta que calcula a disponibilidade "de verdade", validar
//  a entrada recebida e conversar com o banco (pool MySQL).
// ================================================================

const { pool } = require("../database/connection");

// ----------------------------------------------------------------
// BOOK_SELECT: consulta base reaproveitada por getBooks, getBookById,
// createBook e updateBook (todas devolvem o livro no mesmo formato).
//
// O ponto principal está na subconsulta (CASE WHEN EXISTS ...): em vez
// de simplesmente devolver o valor gravado na coluna `disponivel`, ela
// RECALCULA esse campo na hora da consulta. Se existir alguma reserva
// ATIVA ou ATRASADA para o livro, ele é considerado indisponível (0),
// não importa o que esteja salvo na tabela `livros`. Ou seja, a
// disponibilidade mostrada é DERIVADA das reservas, e não é confiada
// cegamente ao valor gravado na coluna.
// ----------------------------------------------------------------
const BOOK_SELECT = `
  SELECT
    l.id_livro,
    l.titulo,
    l.autor,
    l.paginas,
    l.imagem,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM reservas r
        WHERE r.id_livro = l.id_livro
          AND r.status IN ('ATIVA', 'ATRASADA')
      ) THEN 0
      ELSE l.disponivel
    END AS disponivel
  FROM livros l
`;

// --- Funções auxiliares de normalização (tratam a entrada do usuário) ---

// Garante que só chega uma string "limpa" (sem espaços nas pontas);
// qualquer outro tipo vira string vazia.
function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Converte valores variados (boolean, number, string "true"/"1"/"sim"/"yes")
// para um boolean de verdade. Se vier vazio/indefinido, usa o `fallback`.
function normalizeBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    return ["true", "1", "sim", "yes"].includes(value.toLowerCase());
  }
  return fallback;
}

// Converte para número inteiro; se não for um número válido, usa o `fallback`.
function normalizeNumber(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

// ================================================================
//  ENDPOINTS PÚBLICOS (sem exigir login - ver bookRoute.js)
// ================================================================

// GET /books - lista todos os livros, ordenados por título
async function getBooks(req, res) {
  try {
    const [rows] = await pool.query(`${BOOK_SELECT} ORDER BY l.titulo;`);
    return res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error getting books" });
  }
}

// GET /books/:id - busca um único livro pelo id
async function getBookById(req, res) {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    const [rows] = await pool.query(
      `${BOOK_SELECT} WHERE l.id_livro = ?;`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Book not found" });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error getting book" });
  }
}

// ================================================================
//  ENDPOINTS DE ADMIN (autenticado + admin - ver bookRoute.js)
// ================================================================

// POST /books - cria um livro novo.
// Título e autor são obrigatórios; páginas assume 0 se não vier;
// disponível assume true por padrão; imagem é opcional e, se não
// vier, é gravada como null (por isso o livro novo aparece com a
// capa padrão no front, que usa uma imagem de fallback quando `imagem` é null).
async function createBook(req, res) {
  const titulo = normalizeString(req.body.titulo);
  const autor = normalizeString(req.body.autor);
  const paginas = normalizeNumber(req.body.paginas, 0);
  const disponivel = normalizeBoolean(req.body.disponivel, true);

  if (!titulo || !autor) {
    return res.status(400).json({ error: "Titulo e autor obrigatorios" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO livros (titulo, autor, paginas, disponivel, imagem) VALUES (?, ?, ?, ?, ?)",
      [titulo, autor, paginas, disponivel, req.body.imagem || null]
    );

    // Busca o livro recém-criado usando o mesmo SELECT "oficial" (BOOK_SELECT),
    // já com a disponibilidade recalculada, para devolver pronto ao front.
    const [rows] = await pool.query(
      `${BOOK_SELECT} WHERE l.id_livro = ?;`,
      [result.insertId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error creating book" });
  }
}

// PUT /books/:id - atualização PARCIAL: o cliente manda só os campos que
// quer alterar (os demais chegam como undefined e são ignorados abaixo).
async function updateBook(req, res) {
  const id = parseInt(req.params.id, 10);
  const titulo = req.body.titulo === undefined ? undefined : normalizeString(req.body.titulo);
  const autor = req.body.autor === undefined ? undefined : normalizeString(req.body.autor);
  const paginas = req.body.paginas === undefined ? undefined : normalizeNumber(req.body.paginas, 0);
  const disponivel = req.body.disponivel === undefined
    ? undefined
    : normalizeBoolean(req.body.disponivel, true);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  // Se nenhum campo (nem imagem) veio no corpo, não há o que atualizar
  if (titulo === undefined && autor === undefined && paginas === undefined && disponivel === undefined && req.body.imagem === undefined) {
    return res.status(400).json({ error: "Send at least one field" });
  }

  if (titulo !== undefined && !titulo) {
    return res.status(400).json({ error: "Titulo nao pode ser vazio" });
  }

  if (autor !== undefined && !autor) {
    return res.status(400).json({ error: "Autor nao pode ser vazio" });
  }

  try {
    const [existingRows] = await pool.query(
      "SELECT id_livro FROM livros WHERE id_livro = ?",
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Book not found" });
    }

    // Monta o UPDATE dinamicamente: só entram na query os campos que
    // realmente vieram no corpo da requisição. Mesmo sendo montada em
    // partes, a query continua PARAMETRIZADA (usa "?" e o array `params`
    // abaixo) - só o nome da coluna varia, o valor nunca é concatenado
    // direto na string, então não há risco de SQL injection.
    const updates = [];
    const params = [];

    if (titulo !== undefined) {
      updates.push("titulo = ?");
      params.push(titulo);
    }

    if (autor !== undefined) {
      updates.push("autor = ?");
      params.push(autor);
    }

    if (paginas !== undefined) {
      updates.push("paginas = ?");
      params.push(paginas);
    }

    if (disponivel !== undefined) {
      updates.push("disponivel = ?");
      params.push(disponivel);
    }

    if (req.body.imagem !== undefined) {
      updates.push("imagem = ?");
      params.push(req.body.imagem);
    }

    // O id vai por último no array de params, casando com o "WHERE id_livro = ?"
    params.push(id);
    await pool.query(
      `UPDATE livros SET ${updates.join(", ")} WHERE id_livro = ?`,
      params
    );

    // Devolve o livro já atualizado (com disponibilidade recalculada)
    const [updatedRows] = await pool.query(
      `${BOOK_SELECT} WHERE l.id_livro = ?;`,
      [id]
    );

    return res.json(updatedRows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error updating book" });
  }
}

// DELETE /books/:id - remove um livro.
// Roda em TRANSAÇÃO porque duas tabelas são afetadas (reservas e livros):
// ou as duas exclusões acontecem juntas, ou nenhuma acontece (rollback).
// Isso evita deixar reserva "órfã" apontando para um livro que não existe mais.
async function deleteBook(req, res) {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      "SELECT id_livro FROM livros WHERE id_livro = ?",
      [id]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Book not found" });
    }

    // Primeiro apaga as reservas ligadas ao livro, depois o livro em si
    // (nessa ordem, por causa da chave estrangeira reservas.id_livro)
    await connection.query("DELETE FROM reservas WHERE id_livro = ?", [id]);
    await connection.query("DELETE FROM livros WHERE id_livro = ?", [id]);
    await connection.commit();

    // 204 = sucesso sem corpo de resposta (não há o que devolver de um item excluído)
    return res.status(204).send();
  } catch (error) {
    // Algo deu errado no meio do caminho: desfaz tudo (nenhuma exclusão fica pela metade)
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: "Error deleting book" });
  } finally {
    // Sempre devolve a conexão ao pool, tenha dado certo ou errado
    connection.release();
  }
}

// Expõe as funções para o bookRoute.js ligar cada uma a uma rota
module.exports = {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook
};