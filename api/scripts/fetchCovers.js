const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mysql = require("mysql2/promise");

const OPEN_LIBRARY_SEARCH = "https://openlibrary.org/search.json?q=";
const OPEN_LIBRARY_COVER = "https://covers.openlibrary.org/b/id/";

function stripLeadingArticles(title) {
  return title.replace(/^(o |a |os |as |the |le |la |les |der |die |das )/i, "");
}

function buildQueries(titulo, autor) {
  const queries = [];

  queries.push(`${titulo} ${autor}`);

  queries.push(`${titulo} ${autor.replace(/^[^.]+\.\s*/, "")}`);

  queries.push(titulo);

  const stripped = stripLeadingArticles(titulo);
  if (stripped !== titulo) {
    queries.push(`${stripped} ${autor}`);
  }

  return [...new Set(queries)];
}

async function fetchCoverUrl(titulo, autor) {
  const queries = buildQueries(titulo, autor);

  for (const q of queries) {
    const url = OPEN_LIBRARY_SEARCH + encodeURIComponent(q);
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (!data.docs || data.docs.length === 0) continue;

      const first = data.docs[0];

      if (first.cover_i) {
        return `${OPEN_LIBRARY_COVER}${first.cover_i}-L.jpg`;
      }

      if (first.cover_edition_key) {
        return `${OPEN_LIBRARY_COVER}${first.cover_edition_key}-L.jpg`;
      }
    } catch {
      continue;
    }
  }

  return null;
}

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
