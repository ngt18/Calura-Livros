const { pool } = require("../database/connection");


async function getReservations(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM reservas");
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({ error: "Error getting reservations" });
  }
}

async function getReservationById(req, res) {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM reservas WHERE id_reserva = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    return res.status(500).json({ error: "Error getting reservation" });
  }
}

async function createReservation(req, res) {
  const { data_reserva, status, id_usuario, id_livro } = req.body;

  if (!data_reserva || !id_usuario || !id_livro) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
     
    const [book] = await pool.query(
      "SELECT * FROM livros WHERE id_livro = ?",
      [id_livro]
    );

    if (book.length === 0) {
      return res.status(404).json({ error: "Book not found" });
    }

    
    const [user] = await pool.query(
      "SELECT * FROM usuarios WHERE id_usuario = ?",
      [id_usuario]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const [result] = await pool.query(
      "INSERT INTO reservas (data_reserva, status, id_usuario, id_livro) VALUES (?, ?, ?, ?)",
      [data_reserva, status ?? "ATIVA", id_usuario, id_livro]
    );

    return res.status(201).json({
      id: result.insertId,
      data_reserva,
      status: status ?? "ATIVA",
      id_usuario,
      id_livro
    });

  } catch (error) {
    return res.status(500).json({ error: "Error creating reservation" });
  }
}

async function updateReservation(req, res) {
  const id = parseInt(req.params.id);
  const { status } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    const [existing] = await pool.query(
      "SELECT * FROM reservas WHERE id_reserva = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    await pool.query(
      "UPDATE reservas SET status = ? WHERE id_reserva = ?",
      [status, id]
    );

    const [updated] = await pool.query(
      "SELECT * FROM reservas WHERE id_reserva = ?",
      [id]
    );

    return res.json(updated[0]);

  } catch (error) {
    return res.status(500).json({ error: "Error updating reservation" });
  }
}

async function deleteReservation(req, res) {
  const id = parseInt(req.params.id);

  try {
    const [result] = await pool.query(
      "DELETE FROM reservas WHERE id_reserva = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "Error deleting reservation" });
  }
}

module.exports = {
  getReservations,
  getReservationById,
  createReservation,
  updateReservation,
  deleteReservation
};