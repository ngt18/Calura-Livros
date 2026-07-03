const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env") })

const mysql = require("mysql2/promise")
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

async function databaseConnection() {
    try {
         const connection = await pool.getConnection(); 
         console.log("Database successfully connected");
         connection.release();
    } catch(error) {
        console.log(error);
        process.exit(1); 
    }
}

module.exports = { 
    pool,
    databaseConnection
};