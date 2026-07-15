// ================================================================
//  Script: Buscar Capas Faltantes
//  Utilitário de linha de comando - roda com:
//      node scripts/fetchCovers.js
//  Varre a tabela `livros` procurando registros sem capa (imagem
//  NULL ou vazia) e tenta buscar uma capa para cada um na Open
//  Library, atualizando a coluna `imagem` no banco. É a forma de
//  completar capas depois, sob demanda (ex: livros cadastrados
//  manualmente pelo admin, sem imagem).
// ================================================================

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mysql = require("mysql2/promise");
// Reaproveita o mesmo serviço de busca de capa usado no generateSeed
const { fetchCoverUrl } = require("../services/openLibrary");

async function main() {
  // Pool pequeno (5 conexões) só para este script pontual
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
    // Busca só os livros que ainda não têm capa cadastrada
    const [rows] = await pool.query(
      "SELECT id_livro, titulo, autor FROM livros WHERE imagem IS NULL OR imagem = '' ORDER BY id_livro"
    );

    console.log(`Buscando capas para ${rows.length} livros...\n`);

    let updated = 0;
    let failed = 0;

    // Para cada livro sem capa, tenta buscar na Open Library e salvar
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

      // Pequena pausa entre cada busca para não sobrecarregar a API
      // pública da Open Library com muitas requisições seguidas
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
