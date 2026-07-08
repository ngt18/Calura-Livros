const express = require("express");
const cors = require("cors");
const app = express();

const { databaseConnection } = require("./database/connection.js")

const PORT = process.env.PORT || 3031;

const bookRoute = require("./routes/bookRoute")
const reservationRoute = require("./routes/reservationRoute")
const userRoute = require("./routes/userRoute.js")

app.use(cors());
app.use(express.json());
app.use("/books", bookRoute)
app.use("/reservations" , reservationRoute)
app.use("/users", userRoute)

app.get("/", (req, res) => {
  res.json({ status: "ok", name: "CaluraLivros API" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

async function start() {
  await databaseConnection();
  app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
  });
}

start();

module.exports = app;
