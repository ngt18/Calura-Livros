// ================================================================
//  Script: Criar/Resetar o Usuário Admin
//  Utilitário de linha de comando - roda com:
//      node scripts/setupAdmin.js
//  Cria o usuário admin@caluralivros.com se ele não existir, ou
//  reseta a senha dele se já existir - sempre usando a senha definida
//  em DEFAULT_USER_PASSWORD (.env). O hash da senha é gerado na hora,
//  na própria máquina que roda o script.
// ================================================================

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const crypto = require("crypto");
const mysql = require("mysql2/promise");

// Dados fixos do admin padrão do sistema
const ADMIN_EMAIL = "admin@caluralivros.com";
const ADMIN_NOME = "Administrador";
// Senha vem do .env; se não estiver configurada, cai no padrão "123456"
const SENHA = process.env.DEFAULT_USER_PASSWORD || "123456";

async function setupAdmin() {
  // Pool com 1 conexão só, pois este script roda uma vez e termina
  // (diferente da API, que fica no ar atendendo vários pedidos)
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
    // Gera um salt aleatório e o hash scrypt da senha (mesmo método
    // usado no login/cadastro da API), para o admin conseguir entrar
    const senha_salt = crypto.randomBytes(16).toString("hex");
    const senha_hash = crypto
      .scryptSync(SENHA, senha_salt, 64)
      .toString("hex");

    // Verifica se o admin já existe no banco
    const [existing] = await pool.query(
      "SELECT id_usuario, senha_hash FROM usuarios WHERE email = ?",
      [ADMIN_EMAIL]
    );

    if (existing.length > 0) {
      // Já existe: atualiza nome/senha e garante is_admin = TRUE
      await pool.query(
        "UPDATE usuarios SET nome = ?, senha_hash = ?, senha_salt = ?, is_admin = TRUE WHERE email = ?",
        [ADMIN_NOME, senha_hash, senha_salt, ADMIN_EMAIL]
      );
      console.log(`Admin atualizado com senha: ${SENHA}`);
    } else {
      // Não existe ainda: checa se a coluna is_admin já foi criada
      // (caso este script rode antes da auto-migração da API)
      const hasIsAdmin = await pool.query(
        "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'is_admin'",
        [process.env.DB_NAME]
      );

      if (hasIsAdmin[0][0].cnt > 0) {
        // Coluna is_admin já existe: cria o usuário já como admin
        await pool.query(
          "INSERT INTO usuarios (nome, email, senha_hash, senha_salt, is_admin) VALUES (?, ?, ?, ?, TRUE)",
          [ADMIN_NOME, ADMIN_EMAIL, senha_hash, senha_salt]
        );
      } else {
        // Coluna is_admin ainda não existe: cria sem ela (a
        // auto-migração da API cuida de marcar is_admin depois)
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
    // Fecha o pool para o script terminar o processo Node normalmente
    await pool.end();
  }
}

// Executa a função imediatamente ao rodar o script
setupAdmin();
