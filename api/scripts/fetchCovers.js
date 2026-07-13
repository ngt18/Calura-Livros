const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mysql = require("mysql2/promise");
const { fetchCoverUrl } = require("../services/openLibrary");

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    const [rows] = await pool.query(
      "SELECT id_livro, titulo, autor FROM livros WHERE imagem IS NULL OR imagem = '' ORDER BY id_livro"
    );

    console.log(`Buscando capas para ${rows.length} livros...\n`);

    let updated = 0;
    let failed = 0;

    for (const livro of rows) {
      const { id_livro, titulo, autor } = livro;
      const url = await fetchCoverUrl(titulo, autor);

      if (url) {
        await pool.query("UPDATE livros SET imagem = ? WHERE id_livro = ?", [
          url,
          id_livro,
        ]);
        console.log(`[OK] ${titulo}`);
        updated++;
      } else {
        console.log(`[--] ${titulo}`);
        failed++;
      }

      await new Promise((r) => setTimeout(r, 600));
    }

    console.log(`\nConcluido! ${updated} capas atualizadas, ${failed} falhas.`);
  } catch (error) {
    console.error("Erro:", error.message);
  } finally {
    await pool.end();
  }
}

main();
