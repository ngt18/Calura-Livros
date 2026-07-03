const express = require("express");
const app = express();

const { databaseConnection } = require("./database/connection.js")

databaseConnection();

const PORT = process.env.PORT || 3031;

const bookRoute = require("./routes/bookRoute")
const reservationRoute = require("./routes/reservationRoute")
const userRoute = require("./routes/userRoute.js")

app.use(express.json());
app.use("/books", bookRoute)
app.use("/reservations" , reservationRoute)
app.use("/users" , userRoute)

app.listen(PORT, () => {
    console.log (`Server is running on port http://localhost:${PORT}`);
})
