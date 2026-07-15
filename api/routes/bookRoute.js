// ================================================================
//  Rotas de Livros (/books)
//  Este arquivo só "liga os fios": para cada método HTTP + URL,
//  define quais middlewares rodam antes e qual função do controller
//  trata a requisição. Nenhuma regra de negócio fica aqui - isso vive
//  em controllers/bookController.js.
// ================================================================

const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const bookController = require('../controllers/bookController');

// --- Rotas PÚBLICAS: sem middleware, qualquer visitante consulta o catálogo ---
router.get('/', bookController.getBooks);
router.get('/:id', bookController.getBookById);

// --- MIN: exigem estar logado (authMiddleware) E ser
//     adminisRotas de ADtrador (adminMiddleware) para criar, editar ou excluir livros ---
router.post('/', authMiddleware, adminMiddleware, bookController.createBook);
router.put('/:id', authMiddleware, adminMiddleware, bookController.updateBook);
router.delete('/:id', authMiddleware, adminMiddleware, bookController.deleteBook);

module.exports = router;
