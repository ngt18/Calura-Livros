const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

const reservationController = require('../controllers/reservationController');

router.get('/', authMiddleware, reservationController.getReservations);
router.get('/:id', authMiddleware, reservationController.getReservationById);
router.post('/', authMiddleware, reservationController.createReservation);
router.put('/:id', authMiddleware, reservationController.updateReservation);
router.delete('/:id', authMiddleware, reservationController.deleteReservation);

module.exports = router;
