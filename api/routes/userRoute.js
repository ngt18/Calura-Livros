const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const userController = require('../controllers/userController');

router.post('/login', userController.loginUser);
router.post('/', userController.createUser);
router.get('/', authMiddleware, adminMiddleware, userController.getUsers);
router.get('/:id', authMiddleware, adminMiddleware, userController.getUserById);
router.put('/:id', authMiddleware, adminMiddleware, userController.updateUser);
router.delete('/:id', authMiddleware, adminMiddleware, userController.deleteUser);

module.exports = router;
