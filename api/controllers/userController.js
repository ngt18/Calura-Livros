const crypto = require("crypto");
const { promisify } = require("util");
const { pool } = require("../database/connection");

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

function publicUser(user) {
  if (!user) return null;
  return {
    id_usuario: user.id_usuario,
    id: user.id_usuario,
    nome: user.nome,
    email: user.email
  };
}

async function hashPassword(password) {
  const senha_salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, senha_salt, KEY_LENGTH);
  return {
    senha_hash: derivedKey.toString("hex"),
    senha_salt
  };
}

async function verifyPassword(password, user) {
  if (!user.senha_hash || !user.senha_salt) return false;

  const derivedKey = await scrypt(password, user.senha_salt, KEY_LENGTH);
  const storedKey = Buffer.from(user.senha_hash, "hex");

  if (storedKey.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(storedKey, derivedKey);
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getUsers(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT id_usuario, nome, email FROM usuarios ORDER BY nome"
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error getting users" });
  }
}

async function getUserById(req, res) {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT id_usuario, nome, email FROM usuarios WHERE id_usuario = ?",
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

    if (rows.length === 0) {
      return res.status(401).json({ error: "Email ou senha invalidos" });
    }

    const isValid = await verifyPassword(senha, rows[0]);
    if (!isValid) {
      return res.status(401).json({ error: "Email ou senha invalidos" });
    }

    return res.status(200).json(publicUser(rows[0]));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error logging in" });
  }
}

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

    if (email !== undefined) {
      const [duplicated] = await pool.query(
        "SELECT id_usuario FROM usuarios WHERE email = ? AND id_usuario <> ?",
        [email, id]
      );

      if (duplicated.length > 0) {
        return res.status(409).json({ error: "Email ja cadastrado" });
      }
    }

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

    params.push(id);
    await pool.query(
      `UPDATE usuarios SET ${updates.join(", ")} WHERE id_usuario = ?`,
      params
    );

    const [updated] = await pool.query(
      "SELECT id_usuario, nome, email FROM usuarios WHERE id_usuario = ?",
      [id]
    );

    return res.json(updated[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error updating user" });
  }
}

async function deleteUser(req, res) {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(
      "SELECT id_usuario FROM usuarios WHERE id_usuario = ?",
      [id]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "User not found" });
    }

    await connection.query(
      `UPDATE livros l
       JOIN reservas r ON r.id_livro = l.id_livro
       SET l.disponivel = TRUE
       WHERE r.id_usuario = ? AND r.status IN ('ATIVA', 'ATRASADA')`,
      [id]
    );
    await connection.query("DELETE FROM reservas WHERE id_usuario = ?", [id]);
    await connection.query("DELETE FROM usuarios WHERE id_usuario = ?", [id]);
    await connection.commit();

    return res.status(204).send();
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: "Error deleting user" });
  } finally {
    connection.release();
  }
}

module.exports = {
  getUsers,
  getUserById,
  createUser,
  loginUser,
  updateUser,
  deleteUser
};
