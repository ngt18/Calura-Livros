const { pool } = require("../database/connection");

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

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    return ["true", "1", "sim", "yes"].includes(value.toLowerCase());
  }
  return fallback;
}

function normalizeNumber(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

async function getBooks(req, res) {
  try {
    const [rows] = await pool.query(`${BOOK_SELECT} ORDER BY l.titulo;`);
    return res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error getting books" });
  }
}

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

    params.push(id);
    await pool.query(
      `UPDATE livros SET ${updates.join(", ")} WHERE id_livro = ?`,
      params
    );

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

    await connection.query("DELETE FROM reservas WHERE id_livro = ?", [id]);
    await connection.query("DELETE FROM livros WHERE id_livro = ?", [id]);
    await connection.commit();

    return res.status(204).send();
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: "Error deleting book" });
  } finally {
    connection.release();
  }
}

module.exports = {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook
};