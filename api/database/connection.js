const path = require("path")
const crypto = require("crypto")
require("dotenv").config({ path: path.resolve(__dirname, "../.env") })

const mysql = require("mysql2/promise")
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

async function tableExists(connection, tableName) {
    try {
        const [rows] = await connection.query(
            `SELECT COUNT(*) AS total
             FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
            [process.env.DB_NAME, tableName]
        );
        return rows[0].total > 0;
    } catch {
        return false;
    }
}

async function columnExists(connection, tableName, columnName) {
    if (!(await tableExists(connection, tableName))) return true;
    const [rows] = await connection.query(
        `SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [process.env.DB_NAME, tableName, columnName]
    );
    return rows[0].total > 0;
}

async function ensureCoreTables(connection) {
    if (!(await tableExists(connection, "usuarios"))) {
        await connection.query(`
            CREATE TABLE usuarios (
                id_usuario INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                senha_hash VARCHAR(255) NOT NULL,
                senha_salt VARCHAR(64) NOT NULL
            )
        `);
        console.log("Tabela usuarios criada");
    }
    if (!(await tableExists(connection, "livros"))) {
        await connection.query(`
            CREATE TABLE livros (
                id_livro INT AUTO_INCREMENT PRIMARY KEY,
                titulo VARCHAR(150) NOT NULL,
                autor VARCHAR(100) NOT NULL,
                disponivel BOOLEAN DEFAULT TRUE,
                imagem VARCHAR(500)
            )
        `);
        console.log("Tabela livros criada");
    }
    if (!(await tableExists(connection, "reservas"))) {
        await connection.query(`
            CREATE TABLE reservas (
                id_reserva INT AUTO_INCREMENT PRIMARY KEY,
                data_reserva DATE NOT NULL,
                status VARCHAR(30) DEFAULT 'ATIVA',
                id_usuario INT NOT NULL,
                id_livro INT NOT NULL,
                FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
                FOREIGN KEY (id_livro) REFERENCES livros(id_livro) ON DELETE CASCADE
            )
        `);
        console.log("Tabela reservas criada");
    }
}

async function ensureRuntimeSchema(connection) {
    await ensureCoreTables(connection);

    const hasPasswordHash = await columnExists(connection, "usuarios", "senha_hash");
    if (!hasPasswordHash) {
        await connection.query("ALTER TABLE usuarios ADD COLUMN senha_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER email");
    }
    const hasPasswordSalt = await columnExists(connection, "usuarios", "senha_salt");
    if (!hasPasswordSalt) {
        await connection.query("ALTER TABLE usuarios ADD COLUMN senha_salt VARCHAR(64) NOT NULL DEFAULT '' AFTER senha_hash");
    }
    const [legacyUsers] = await connection.query(
        "SELECT id_usuario FROM usuarios WHERE senha_hash IS NULL OR senha_hash = '' OR senha_salt IS NULL OR senha_salt = ''"
    );
    for (const user of legacyUsers) {
        const senha_salt = crypto.randomBytes(16).toString("hex");
        const senha_hash = crypto
            .scryptSync(process.env.DEFAULT_USER_PASSWORD || "123456", senha_salt, 64)
            .toString("hex");
        await connection.query(
            "UPDATE usuarios SET senha_hash = ?, senha_salt = ? WHERE id_usuario = ?",
            [senha_hash, senha_salt, user.id_usuario]
        );
    }

    const hasIsAdmin = await columnExists(connection, "usuarios", "is_admin");
    if (!hasIsAdmin) {
        await connection.query("ALTER TABLE usuarios ADD COLUMN is_admin BOOLEAN DEFAULT FALSE AFTER senha_salt");
    }
    await connection.query(
        "UPDATE usuarios SET is_admin = TRUE WHERE email = 'admin@caluralivros.com'"
    );

    const hasPaginas = await columnExists(connection, "livros", "paginas");
    if (!hasPaginas) {
        await connection.query("ALTER TABLE livros ADD COLUMN paginas INT DEFAULT 0 AFTER autor");
    }

    const hasImagem = await columnExists(connection, "livros", "imagem");
    if (!hasImagem) {
        await connection.query("ALTER TABLE livros ADD COLUMN imagem VARCHAR(500) AFTER disponivel");
    }

    const hasDataEmprestimo = await columnExists(connection, "reservas", "data_emprestimo");
    if (!hasDataEmprestimo) {
        await connection.query("ALTER TABLE reservas ADD COLUMN data_emprestimo DATE AFTER data_reserva");
    }
    const hasDataPrevista = await columnExists(connection, "reservas", "data_prevista");
    if (!hasDataPrevista) {
        await connection.query("ALTER TABLE reservas ADD COLUMN data_prevista DATE AFTER data_emprestimo");
    }
    const hasDataDevolucao = await columnExists(connection, "reservas", "data_devolucao");
    if (!hasDataDevolucao) {
        await connection.query("ALTER TABLE reservas ADD COLUMN data_devolucao DATE AFTER data_prevista");
    }
}

async function databaseConnection() {
    try {
         const connection = await pool.getConnection(); 
         await ensureRuntimeSchema(connection);
         console.log("Database successfully connected");
         connection.release();
    } catch(error) {
        console.error(error);
        process.exit(1); 
    }
}

module.exports = { 
    pool,
    databaseConnection
};
