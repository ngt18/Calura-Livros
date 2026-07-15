// ================================================================
//  Middleware de Autenticação e Autorização
//  A "portaria" da API: confere quem está logado (authMiddleware) e,
//  depois, quem tem permissão de administrador (adminMiddleware).
// ================================================================

const jwt = require("jsonwebtoken");

// Exige um token JWT válido no header "Authorization: Bearer <token>".
// - Sem header/formato correto, ou token inválido/expirado (jwt.verify
//   lança erro): responde 401 (não autenticado) e barra a requisição aqui.
// - Token válido: guarda os dados decodificados (id_usuario, email, is_admin)
//   em req.user e chama next() para seguir para a próxima função da rota.
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autenticacao necessario" });
  }
  const token = authHeader.split(" ")[1]; // remove o prefixo "Bearer ", sobrando só o token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token invalido ou expirado" });
  }
}

// Exige que o usuário autenticado seja administrador.
// Deve rodar DEPOIS do authMiddleware (é ele quem preenche req.user); aqui
// só resta checar req.user.is_admin.
// Repare na diferença para o 401 do authMiddleware: aqui o token já é válido
// (o usuário ESTÁ autenticado), só que ele não tem permissão para acessar
// este recurso — por isso o status é 403 (proibido), e não 401.
function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: "Acesso restrito a administradores" });
  }
  next();
}

// Exportado para ser usado nas rotas que exigem login e/ou permissão de
// administrador (ver routes/userRoute.js, routes/bookRoute.js e
// routes/reservationRoute.js).
module.exports = { authMiddleware, adminMiddleware };
