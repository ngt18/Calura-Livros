// ================================================================
//  Conexão com o Banco de Dados (MySQL)
//  Cria o pool de conexões usado por toda a API e garante que as
//  tabelas e colunas necessárias existam antes do servidor subir.
// ================================================================

const path = require("path")
const crypto = require("crypto")

// Carrega as variáveis do arquivo .env (DB_HOST, DB_USER, DB_PASSWORD...)
// para dentro de process.env, antes de qualquer código usá-las
require("dotenv").config({ path: path.resolve(__dirname, "../.env") })

// ================================================================
//  POOL DE CONEXÕES
//  Em vez de abrir e fechar uma conexão nova a cada consulta (caro e
//  lento), o pool mantém conexões abertas e as reaproveita.
//  Analogia: caixas de um mercado - em vez de abrir um caixa novo
//  para cada cliente, um grupo fixo de caixas atende todo mundo.
//  connectionLimit é o número máximo de conexões abertas ao mesmo tempo.
// ================================================================
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

// ================================================================
//  VERIFICAÇÃO DE SCHEMA
//  Consultam o INFORMATION_SCHEMA (uma espécie de "banco de dados
//  sobre o banco de dados" que o próprio MySQL mantém) para saber
//  se uma tabela ou coluna já existe, antes de tentar criá-la.
// ================================================================

// Retorna true se a tabela `tableName` já existe no banco atual
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
        // Se a consulta falhar, assume que a tabela não existe
        return false;
    }
}

// Retorna true se a coluna `columnName` já existe na tabela `tableName`.
// Se a tabela em si ainda não existe, retorna true (não há coluna
// "faltando" para adicionar - a tabela toda será criada do zero)
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

// ================================================================
//  CRIAÇÃO DAS TABELAS PRINCIPAIS
//  Cria as 3 tabelas base do sistema (usuarios, livros, reservas)
//  caso ainda não existam. Não faz nada se elas já foram criadas -
//  por isso é seguro chamar isso toda vez que a API sobe.
// ================================================================
async function ensureCoreTables(connection) {
    // Tabela de usuários (login, senha guardada como hash + salt)
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
    // Tabela de livros do catálogo
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
    // Tabela de reservas/empréstimos, ligando um usuário a um livro
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

// ================================================================
//  AUTO-MIGRAÇÃO DO SCHEMA
//  Roda toda vez que a API sobe (ver databaseConnection). Compara o
//  banco atual com o que o sistema espera e vai ADICIONANDO o que
//  falta (colunas novas, ajustes), sem apagar nada que já existe.
//  Como cada passo primeiro checa "isso já existe?" antes de alterar.
// ================================================================
async function ensureRuntimeSchema(connection) {
    // Primeiro garante que as 3 tabelas base existam
    await ensureCoreTables(connection);

    // --- Colunas de senha (hash + salt) em usuarios ---
    const hasPasswordHash = await columnExists(connection, "usuarios", "senha_hash");
    if (!hasPasswordHash) {
        await connection.query("ALTER TABLE usuarios ADD COLUMN senha_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER email");
    }
    const hasPasswordSalt = await columnExists(connection, "usuarios", "senha_salt");
    if (!hasPasswordSalt) {
        await connection.query("ALTER TABLE usuarios ADD COLUMN senha_salt VARCHAR(64) NOT NULL DEFAULT '' AFTER senha_hash");
    }
    // Usuários "legados" são os que vieram do seed.sql sem senha de
    // verdade (senha_hash/senha_salt em branco). Para cada um deles,
    // gera agora um hash real, usando a senha padrão configurada em
    // DEFAULT_USER_PASSWORD (.env), para que consigam fazer login.
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

    // --- Coluna is_admin em usuarios ---
    const hasIsAdmin = await columnExists(connection, "usuarios", "is_admin");
    if (!hasIsAdmin) {
        await connection.query("ALTER TABLE usuarios ADD COLUMN is_admin BOOLEAN DEFAULT FALSE AFTER senha_salt");
    }
    // Garante que o admin padrão do sistema sempre seja admin de
    // verdade, mesmo que a coluna is_admin tenha acabado de ser criada
    await connection.query(
        "UPDATE usuarios SET is_admin = TRUE WHERE email = 'admin@caluralivros.com'"
    );

    // --- Colunas extras em livros ---
    const hasPaginas = await columnExists(connection, "livros", "paginas");
    if (!hasPaginas) {
        await connection.query("ALTER TABLE livros ADD COLUMN paginas INT DEFAULT 0 AFTER autor");
    }

    const hasImagem = await columnExists(connection, "livros", "imagem");
    if (!hasImagem) {
        await connection.query("ALTER TABLE livros ADD COLUMN imagem VARCHAR(500) AFTER disponivel");
    }

    // --- Colunas de datas em reservas (empréstimo / previsão / devolução) ---
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

// ================================================================
//  BOOT DA CONEXÃO
//  Chamada uma vez quando a API sobe: testa se consegue conectar no
//  MySQL e roda a auto-migração do schema. Se o banco estiver fora
//  do ar (ou a migração falhar), a API é encerrada com process.exit -
//  preferimos travar aqui a deixar o servidor no ar "meio vivo",
//  sem banco de dados disponível.
// ================================================================
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

// ================================================================
//  EXPORTS
//  pool: usado pelos demais arquivos da API para rodar queries
//  databaseConnection: chamado no arquivo principal do servidor, para
//  validar a conexão e migrar o schema assim que a API é iniciada
// ================================================================
module.exports = { 
    pool,
    databaseConnection
};
