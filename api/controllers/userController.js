// ================================================================
//  Controller de Usuários
//  Cadastro, login, atualização, exclusão e o "público" de usuário
//  exposto pela API. Concentra toda a lógica de senha (hash + salt)
//  e a emissão do token JWT usado pelo middleware de autenticação.
// ================================================================

const crypto = require("crypto");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const { pool } = require("../database/connection");

// crypto.scrypt usa callback; promisify permite chamar com await.
// KEY_LENGTH é o tamanho (em bytes) do hash de senha gerado pelo scrypt.
const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

// ================================================================
//  HELPERS DE SEGURANÇA
//  Formatação da resposta pública e hash/verificação de senha (scrypt)
// ================================================================

// Monta a versão "pública" do usuário, pronta para ser enviada nas respostas.
// NUNCA inclui senha_hash/senha_salt aqui — mesmo que `user` venha de um
// "SELECT *" (com os campos sensíveis), esta função filtra e devolve só
// os dados que podem ser expostos ao cliente.
function publicUser(user) {
  if (!user) return null;
  return {
    id_usuario: user.id_usuario,
    id: user.id_usuario,
    nome: user.nome,
    email: user.email,
    is_admin: Boolean(user.is_admin)
  };
}

// Gera o hash + salt de uma senha, prontos para salvar no banco.
// - senha_salt: 16 bytes aleatórios, únicos a cada chamada — o salt garante
//   que duas senhas iguais gerem hashes diferentes, o que impede ataques de
//   rainbow table (tabelas prontas com hash de senhas comuns).
// - scrypt: função de derivação de chave propositalmente lenta/pesada (usa
//   CPU e memória), tornando ataques de força bruta muito mais caros do que
//   com um hash rápido (tipo MD5/SHA1 puro).
async function hashPassword(password) {
  const senha_salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, senha_salt, KEY_LENGTH);
  return {
    senha_hash: derivedKey.toString("hex"),
    senha_salt
  };
}

// Confere se `password` (senha digitada no login) é a senha correta do usuário.
// Recalcula o hash usando o MESMO salt que foi salvo no cadastro e compara
// o resultado com o hash salvo — nunca guardamos a senha em texto puro.
async function verifyPassword(password, user) {
  if (!user.senha_hash || !user.senha_salt) return false;

  const derivedKey = await scrypt(password, user.senha_salt, KEY_LENGTH);
  const storedKey = Buffer.from(user.senha_hash, "hex");

  if (storedKey.length !== derivedKey.length) return false;
  // Comparação em tempo CONSTANTE: com "===" ou Buffer.compare, o tempo de
  // resposta variaria conforme quantos bytes já batem entre os dois hashes,
  // vazando informação (timing attack). timingSafeEqual sempre leva o mesmo
  // tempo, não importa onde os buffers começam a diferir.
  return crypto.timingSafeEqual(storedKey, derivedKey);
}

// Remove espaços das pontas; se não vier uma string, retorna "" em vez de
// quebrar (evita erro ao chamar .trim() em undefined/null/número etc.).
function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

// ================================================================
//  ENDPOINTS DE USUÁRIO
//  Cada função abaixo é usada pelas rotas em routes/userRoute.js
// ================================================================

// GET /usuarios — lista todos os usuários cadastrados.
// O SELECT já pede só colunas públicas, então senha_hash/senha_salt nunca
// saem do banco nesta consulta.
async function getUsers(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT id_usuario, nome, email, is_admin FROM usuarios ORDER BY nome"
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error getting users" });
  }
}

// GET /usuarios/:id — busca um usuário específico pelo id.
// Responde 400 se o id não for um número válido e 404 se não existir.
async function getUserById(req, res) {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT id_usuario, nome, email, is_admin FROM usuarios WHERE id_usuario = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error getting user" });
  }
}

// Cria um novo usuário (cadastro).
// - Normaliza nome/email/senha e exige que os três venham preenchidos.
// - Exige senha com pelo menos 6 caracteres.
// - Se o email já existir, responde 409 (conflito) em vez de duplicar o cadastro.
// - Salva só o hash + salt da senha no banco (nunca a senha em texto puro).
// - Responde 201 (criado) com os dados públicos do usuário — sem senha_hash/senha_salt.
async function createUser(req, res) {
  const nome = normalizeString(req.body.nome);
  const email = normalizeString(req.body.email).toLowerCase();
  const senha = normalizeString(req.body.senha || req.body.password);

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: "Nome, email e senha obrigatorios" });
  }

  if (senha.length < 6) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
  }

  try {
    const [existing] = await pool.query(
      "SELECT id_usuario FROM usuarios WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "Email ja cadastrado" });
    }

    const { senha_hash, senha_salt } = await hashPassword(senha);
    const [result] = await pool.query(
      "INSERT INTO usuarios (nome, email, senha_hash, senha_salt) VALUES (?, ?, ?, ?)",
      [nome, email, senha_hash, senha_salt]
    );

    return res.status(201).json(publicUser({
      id_usuario: result.insertId,
      nome,
      email
    }));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error creating user" });
  }
}

// Autentica um usuário (login).
// Em caso de sucesso, devolve os dados públicos do usuário + um token JWT,
// que o cliente deve reenviar (header Authorization) nas próximas
// requisições — ver middleware/auth.js.
async function loginUser(req, res) {
  const email = normalizeString(req.body.email).toLowerCase();
  const senha = normalizeString(req.body.senha || req.body.password);

  if (!email || !senha) {
    return res.status(400).json({ error: "Email e senha obrigatorios" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM usuarios WHERE email = ?",
      [email]
    );

    // Mesma mensagem genérica nos dois casos (email não encontrado OU senha
    // incorreta), de propósito: assim quem tenta adivinhar credenciais não
    // descobre, pela resposta, se aquele email está cadastrado ou não.
    if (rows.length === 0) {
      return res.status(401).json({ error: "Email ou senha invalidos" });
    }

    const isValid = await verifyPassword(senha, rows[0]);
    if (!isValid) {
      return res.status(401).json({ error: "Email ou senha invalidos" });
    }

    const user = rows[0];
    // Assina o token JWT com id, email e is_admin (é isso que o authMiddleware
    // vai decodificar depois em req.user). JWT_SECRET é a chave secreta do
    // servidor (variável de ambiente) usada para assinar e, depois, validar
    // a assinatura. O token expira em 24h.
    const token = jwt.sign(
      { id_usuario: user.id_usuario, email: user.email, is_admin: Boolean(user.is_admin) },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(200).json({
      ...publicUser(user),
      token
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error logging in" });
  }
}

// Atualiza um usuário existente.
// Atualização PARCIAL: nome, email e senha são todos opcionais no corpo da
// requisição — só os campos realmente enviados são alterados (mas é preciso
// mandar pelo menos um deles).
async function updateUser(req, res) {
  const id = parseInt(req.params.id, 10);
  const nome = req.body.nome === undefined ? undefined : normalizeString(req.body.nome);
  const email = req.body.email === undefined ? undefined : normalizeString(req.body.email).toLowerCase();
  const senha = req.body.senha === undefined && req.body.password === undefined
    ? undefined
    : normalizeString(req.body.senha || req.body.password);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  if (nome === undefined && email === undefined && senha === undefined) {
    return res.status(400).json({ error: "Send at least one field" });
  }

  if (nome !== undefined && !nome) {
    return res.status(400).json({ error: "Nome nao pode ser vazio" });
  }

  if (email !== undefined && !email) {
    return res.status(400).json({ error: "Email nao pode ser vazio" });
  }

  if (senha !== undefined && senha.length < 6) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
  }

  try {
    const [existing] = await pool.query(
      "SELECT id_usuario FROM usuarios WHERE id_usuario = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Se o email está sendo alterado, garante que nenhum OUTRO usuário já
    // esteja usando esse email (por isso o "id_usuario <> ?", excluindo o
    // próprio usuário da checagem).
    if (email !== undefined) {
      const [duplicated] = await pool.query(
        "SELECT id_usuario FROM usuarios WHERE email = ? AND id_usuario <> ?",
        [email, id]
      );

      if (duplicated.length > 0) {
        return res.status(409).json({ error: "Email ja cadastrado" });
      }
    }

    // Monta a query UPDATE dinamicamente: só entra "coluna = ?" para os
    // campos que realmente vieram no corpo da requisição.
    const updates = [];
    const params = [];

    if (nome !== undefined) {
      updates.push("nome = ?");
      params.push(nome);
    }

    if (email !== undefined) {
      updates.push("email = ?");
      params.push(email);
    }

    if (senha !== undefined) {
      const { senha_hash, senha_salt } = await hashPassword(senha);
      updates.push("senha_hash = ?", "senha_salt = ?");
      params.push(senha_hash, senha_salt);
    }

    // Mesmo com o SET montado dinamicamente, a query continua parametrizada:
    // os valores viajam em "params" (substituindo os "?"), nunca concatenados
    // direto na string. "updates" só contém nomes de coluna fixos, definidos
    // aqui em cima — nunca texto vindo do usuário — por isso não há risco de
    // SQL injection.
    params.push(id);
    await pool.query(
      `UPDATE usuarios SET ${updates.join(", ")} WHERE id_usuario = ?`,
      params
    );

    const [updated] = await pool.query(
      "SELECT id_usuario, nome, email, is_admin FROM usuarios WHERE id_usuario = ?",
      [id]
    );

    return res.json(updated[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error updating user" });
  }
}

// Remove um usuário definitivamente.
// Tudo roda dentro de uma TRANSAÇÃO: se qualquer passo falhar, os anteriores
// são desfeitos (rollback), então o banco nunca fica num estado inconsistente
// (ex.: reservas apagadas mas usuário não, ou vice-versa).
async function deleteUser(req, res) {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  // Pega uma conexão exclusiva do pool: a transação (begin/commit/rollback)
  // precisa ser feita sempre na mesma conexão.
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(
      "SELECT id_usuario FROM usuarios WHERE id_usuario = ?",
      [id]
    );

    // Usuário não existe: desfaz a transação (rollback, mesmo sem ter
    // alterado nada ainda) e responde 404.
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "User not found" });
    }

    // 1) Libera os livros que estavam presos em reservas ATIVA/ATRASADA
    //    deste usuário (senão ficariam "presos", indisponíveis para sempre).
    await connection.query(
      `UPDATE livros l
       JOIN reservas r ON r.id_livro = l.id_livro
       SET l.disponivel = TRUE
       WHERE r.id_usuario = ? AND r.status IN ('ATIVA', 'ATRASADA')`,
      [id]
    );
    // 2) Remove as reservas do usuário.
    await connection.query("DELETE FROM reservas WHERE id_usuario = ?", [id]);
    // 3) Remove o próprio usuário.
    await connection.query("DELETE FROM usuarios WHERE id_usuario = ?", [id]);
    // Deu tudo certo: confirma (grava definitivamente) as três operações acima.
    await connection.commit();

    return res.status(204).send();
  } catch (error) {
    // Algo deu errado no meio da transação: desfaz tudo que já tinha rodado.
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: "Error deleting user" });
  } finally {
    // Sempre devolve a conexão ao pool, tenha dado certo ou errado.
    connection.release();
  }
}

// Exporta as funções para serem ligadas às rotas em routes/userRoute.js
module.exports = {
  getUsers,
  getUserById,
  createUser,
  loginUser,
  updateUser,
  deleteUser
};
