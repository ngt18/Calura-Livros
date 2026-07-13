const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const crypto = require("crypto");
const mysql = require("mysql2/promise");

const ADMIN_EMAIL = "admin@caluralivros.com";
const ADMIN_NOME = "Administrador";
const SENHA = process.env.DEFAULT_USER_PASSWORD || "123456";

async function setupAdmin() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 1,
  });

  try {
    const senha_salt = crypto.randomBytes(16).toString("hex");
    const senha_hash = crypto
      .scryptSync(SENHA, senha_salt, 64)
      .toString("hex");

    const [existing] = await pool.query(
      "SELECT id_usuario, senha_hash FROM usuarios WHERE email = ?",
      [ADMIN_EMAIL]
    );

    if (existing.length > 0) {
      await pool.query(
        "UPDATE usuarios SET nome = ?, senha_hash = ?, senha_salt = ?, is_admin = TRUE WHERE email = ?",
        [ADMIN_NOME, senha_hash, senha_salt, ADMIN_EMAIL]
      );
      console.log(`Admin atualizado com senha: ${SENHA}`);
    } else {
      const hasIsAdmin = await pool.query(
        "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'is_admin'",
        [process.env.DB_NAME]
      );

      if (hasIsAdmin[0][0].cnt > 0) {
        await pool.query(
          "INSERT INTO usuarios (nome, email, senha_hash, senha_salt, is_admin) VALUES (?, ?, ?, ?, TRUE)",
          [ADMIN_NOME, ADMIN_EMAIL, senha_hash, senha_salt]
        );
      } else {
        await pool.query(
          "INSERT INTO usuarios (nome, email, senha_hash, senha_salt) VALUES (?, ?, ?, ?)",
          [ADMIN_NOME, ADMIN_EMAIL, senha_hash, senha_salt]
        );
      }
      console.log(`Admin criado com senha: ${SENHA}`);
    }

    console.log("Email: " + ADMIN_EMAIL);
    console.log("Pronto! O admin pode logar agora.");
  } catch (error) {
    console.error("Erro:", error.message);
  } finally {
    await pool.end();
  }
}

setupAdmin();
