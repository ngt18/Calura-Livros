// ================================================================
//  Rotas de Usuários (/users)
//  Este arquivo só "liga os fios": para cada método HTTP + URL,
//  define quais middlewares rodam antes e qual função do controller
//  trata a requisição. Nenhuma regra de negócio fica aqui - isso vive
//  em controllers/userController.js.
// ================================================================

const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const userController = require('../controllers/userController');

// --- Rotas PÚBLICAS: login e cadastro, ninguém precisa estar logado ainda ---
router.post('/login', userController.loginUser);
router.post('/', userController.createUser);

// --- Rotas de ADMIN: listar, ver detalhe, editar e excluir usuários
//     exigem estar logado (authMiddleware) E ser administrador
//     (adminMiddleware) ---
router.get('/', authMiddleware, adminMiddleware, userController.getUsers);
router.get('/:id', authMiddleware, adminMiddleware, userController.getUserById);
router.put('/:id', authMiddleware, adminMiddleware, userController.updateUser);
router.delete('/:id', authMiddleware, adminMiddleware, userController.deleteUser);

module.exports = router;
