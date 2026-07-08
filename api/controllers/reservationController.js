const { pool } = require("../database/connection");

const ACTIVE_STATUSES = ["ATIVA", "ATRASADA"];
const VALID_STATUSES = ["ATIVA", "ATRASADA", "DEVOLVIDO", "CANCELADA"];

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

function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status);
}

async function syncBookAvailability(connection, bookId) {
  const [activeReservations] = await connection.query(
    "SELECT id_reserva FROM reservas WHERE id_livro = ? AND status IN ('ATIVA', 'ATRASADA') LIMIT 1",
    [bookId]
  );

  await connection.query(
    "UPDATE livros SET disponivel = ? WHERE id_livro = ?",
    [activeReservations.length === 0, bookId]
  );
}

async function getReservations(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, u.nome AS usuario_nome, u.email AS usuario_email, l.titulo AS livro_titulo, l.autor AS livro_autor
       FROM reservas r
       JOIN usuarios u ON u.id_usuario = r.id_usuario
       JOIN livros l ON l.id_livro = r.id_livro
       ORDER BY r.id_reserva DESC`
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error getting reservations" });
  }
}

async function getReservationById(req, res) {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT r.*, u.nome AS usuario_nome, u.email AS usuario_email, l.titulo AS livro_titulo, l.autor AS livro_autor
       FROM reservas r
       JOIN usuarios u ON u.id_usuario = r.id_usuario
       JOIN livros l ON l.id_livro = r.id_livro
       WHERE r.id_reserva = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error getting reservation" });
  }
}

async function createReservation(req, res) {
  const data_reserva = req.body.data_reserva || new Date().toISOString().split("T")[0];
  const id_usuario = parseInt(req.body.id_usuario, 10);
  const id_livro = parseInt(req.body.id_livro, 10);
  const status = normalizeStatus(req.body.status, "ATIVA");

  if (!data_reserva || Number.isNaN(id_usuario) || Number.isNaN(id_livro)) {
    return res.status(400).json({ error: "Missing fields" });
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [book] = await connection.query(
      "SELECT * FROM livros WHERE id_livro = ? FOR UPDATE",
      [id_livro]
    );

    if (book.length === 0) {
      await connection.rollback();
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

    const [activeBookReservation] = await connection.query(
      "SELECT id_reserva FROM reservas WHERE id_livro = ? AND status IN ('ATIVA', 'ATRASADA') LIMIT 1",
      [id_livro]
    );

    if (isActiveStatus(status) && (!book[0].disponivel || activeBookReservation.length > 0)) {
      await connection.rollback();
      return res.status(409).json({ error: "Book is not available" });
    }

    const [activeUserReservation] = await connection.query(
      "SELECT id_reserva FROM reservas WHERE id_usuario = ? AND id_livro = ? AND status IN ('ATIVA', 'ATRASADA') LIMIT 1",
      [id_usuario, id_livro]
    );

    if (isActiveStatus(status) && activeUserReservation.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: "User already has an active reservation for this book" });
    }

    const [result] = await connection.query(
      "INSERT INTO reservas (data_reserva, status, id_usuario, id_livro) VALUES (?, ?, ?, ?)",
      [data_reserva, status, id_usuario, id_livro]
    );

    await syncBookAvailability(connection, id_livro);
    await connection.commit();

    return res.status(201).json({
      id_reserva: result.insertId,
      id: result.insertId,
      data_reserva,
      status,
      id_usuario,
      id_livro
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: "Error creating reservation" });
  } finally {
    connection.release();
  }
}

async function updateReservation(req, res) {
  const id = parseInt(req.params.id, 10);
  const status = normalizeStatus(req.body.status);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
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

    const reservation = existing[0];

    if (isActiveStatus(status) && !isActiveStatus(reservation.status)) {
      const [book] = await connection.query(
        "SELECT * FROM livros WHERE id_livro = ? FOR UPDATE",
        [reservation.id_livro]
      );

      const [activeBookReservation] = await connection.query(
        "SELECT id_reserva FROM reservas WHERE id_livro = ? AND id_reserva <> ? AND status IN ('ATIVA', 'ATRASADA') LIMIT 1",
        [reservation.id_livro, id]
      );

      if (book.length === 0 || !book[0].disponivel || activeBookReservation.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: "Book is not available" });
      }
    }

    await connection.query(
      "UPDATE reservas SET status = ? WHERE id_reserva = ?",
      [status, id]
    );

    await syncBookAvailability(connection, reservation.id_livro);
    await connection.commit();

    const [updated] = await pool.query(
      "SELECT * FROM reservas WHERE id_reserva = ?",
      [id]
    );

    return res.json(updated[0]);
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: "Error updating reservation" });
  } finally {
    connection.release();
  }
}

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

    await syncBookAvailability(connection, existing[0].id_livro);
    await connection.commit();

    return res.status(204).send();
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: "Error deleting reservation" });
  } finally {
    connection.release();
  }
}

module.exports = {
  getReservations,
  getReservationById,
  createReservation,
  updateReservation,
  deleteReservation
};
