// ================================================================
//  Calura Livros - API (ponto de entrada do Express)
//  Aqui o app é criado, os middlewares globais são registrados,
//  os roteadores de cada recurso são "plugados" e o servidor só
//  começa a escutar depois que o banco de dados confirma conexão.
// ================================================================

const express = require("express");
// cors: libera chamadas do navegador vindas de outra origem (front x API)
const cors = require("cors");
const app = express();

// Garante que as tabelas existem e abre a conexão com o MySQL (ver database/connection.js)
const { databaseConnection } = require("./database/connection.js")

const PORT = process.env.PORT || 3031;

// --- Roteadores: cada um concentra as rotas de um recurso da API ---
const bookRoute = require("./routes/bookRoute")
const reservationRoute = require("./routes/reservationRoute")
const userRoute = require("./routes/userRoute.js")

// cors(): autoriza o navegador a chamar esta API mesmo rodando em outra porta
// (ex.: front em http://localhost:5173 e API em http://localhost:3031).
// Sem isso, o navegador bloquearia a requisição por política de CORS.
app.use(cors());
// express.json(): lê o corpo (body) das requisições em JSON e transforma em
// objeto JS, disponível como req.body dentro dos controllers.
app.use(express.json());
// A partir daqui, toda URL que começar com /books cai no bookRoute, e assim por diante.
app.use("/books", bookRoute)
app.use("/reservations" , reservationRoute)
app.use("/users", userRoute)

// Healthcheck simples: só serve para confirmar que a API está no ar
// (ex.: acessando http://localhost:3031/ no navegador).
app.get("/", (req, res) => {
  res.json({ status: "ok", name: "CaluraLivros API" });
});

// Middleware "coringa": como fica depois de todas as rotas acima, só é
// executado quando nenhuma delas bateu com a URL pedida. Funciona como
// fallback de 404 para rota não mapeada.
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Inicializa o servidor. A ordem aqui é proposital:
async function start() {
  // 1) Primeiro espera o banco conectar (e garantir as tabelas)...
  await databaseConnection();
  // 2) ...só depois o Express passa a aceitar requisições na porta.
  //    Assim a API nunca fica no ar sem banco disponível.
  app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
  });
}

start();

module.exports = app;
