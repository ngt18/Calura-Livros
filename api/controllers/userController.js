const { pool } = require("../database/connection");


async function getUsers(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM usuarios");
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({ error: "Error getting users" });
  }
}


async function getUserById(req, res) {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM usuarios WHERE id_usuario = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    return res.status(500).json({ error: "Error getting user" });
  }
}

async function createUser(req, res) {
  const { nome, email } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ error: "Nome e email obrigatórios" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO usuarios (nome, email) VALUES (?, ?)",
      [nome, email]
    );

    return res.status(201).json({
      id: result.insertId,
      nome,
      email
    });
  } catch (error) {
    return res.status(500).json({ error: "Error creating user" });
  }
}

async function updateUser(req, res) {
  const id = parseInt(req.params.id);
  const { nome, email } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  if (nome === undefined && email === undefined) {
    return res.status(400).json({ error: "Send at least one field" });
  }

  try {
    const [existing] = await pool.query(
      "SELECT * FROM usuarios WHERE id_usuario = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    let updates = [];
    let params = [];

    if (nome !== undefined) {
      updates.push("nome = ?");
      params.push(nome);
    }

    if (email !== undefined) {
      updates.push("email = ?");
      params.push(email);
    }

    params.push(id);

    const sql = `UPDATE usuarios SET ${updates.join(", ")} WHERE id_usuario = ?`;

    await pool.query(sql, params);

    const [updated] = await pool.query(
      "SELECT * FROM usuarios WHERE id_usuario = ?",
      [id]
    );

    return res.json(updated[0]);
  } catch (error) {
    return res.status(500).json({ error: "Error updating user" });
  }
}


async function deleteUser(req, res) {
  const id = parseInt(req.params.id);

  try {
    const [result] = await pool.query(
      "DELETE FROM usuarios WHERE id_usuario = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "Error deleting user" });
  }
}

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};