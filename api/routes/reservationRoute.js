// ================================================================
//  Rotas de Reservas (/reservations)
//  Este arquivo só "liga os fios": para cada método HTTP + URL,
//  define quais middlewares rodam antes e qual função do controller
//  trata a requisição. Nenhuma regra de negócio fica aqui - isso vive
//  em controllers/reservationController.js.
// ================================================================

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

const reservationController = require('../controllers/reservationController');

// Todas as rotas de reserva exigem estar logado (authMiddleware).
// Repare que NÃO existe adminMiddleware aqui: quando uma ação é
// restrita a administradores (por exemplo, mexer na reserva de outro
// usuário), essa checagem de "isAdmin" é feita DENTRO do
// reservationController, e não nesta camada de rotas.
router.get('/', authMiddleware, reservationController.getReservations);
router.get('/:id', authMiddleware, reservationController.getReservationById);
router.post('/', authMiddleware, reservationController.createReservation);
router.put('/:id', authMiddleware, reservationController.updateReservation);
router.delete('/:id', authMiddleware, reservationController.deleteReservation);

module.exports = router;
