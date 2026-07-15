// ================================================================
//  Calura Livros - Servidor estático do Frontend
//  Servidor bem simples, feito só com o módulo "http" nativo do
//  Node (SEM Express!). Sua única função é servir os arquivos da
//  pasta frontend (html/css/js) na porta 5173.
//  Quem fala com o banco de dados é a API (pasta api/), na porta 3031.
// ================================================================

// Módulos nativos do Node - não precisa instalar nada (npm install) pra isso
const http = require('http');
const fs = require('fs');
const path = require('path');

// Porta onde o frontend fica disponível: http://localhost:5173
const PORT = 5173;
// "Dicionário" que traduz a extensão do arquivo pedido no Content-Type
// correto da resposta HTTP (sem isso, o navegador não sabe interpretar
// o arquivo certo - ex.: tentaria abrir um .js como texto puro)
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ================================================================
//  ROTEAMENTO DE ARQUIVOS + FALLBACK DE SPA
//  Para cada requisição, tenta servir o arquivo pedido. Se o arquivo
//  não existir, devolve o index.html mesmo assim - é o que permite
//  dar F5 numa URL tipo /admin/livros sem tomar erro 404: o servidor
//  manda o index.html, e é o app.js (JS puro) quem lê a URL do
//  navegador e desenha a tela certa.
// ================================================================
const server = http.createServer((req, res) => {
  // Se pediu "/" (raiz), serve o index.html; senão, serve o caminho pedido
  // (ex.: /app.js, /styles.css) dentro da pasta do frontend
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  // Descobre o Content-Type pela extensão; se for desconhecida, usa um
  // tipo genérico
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Arquivo não encontrado (ex.: rota da SPA como /admin/livros, que
      // não existe de verdade em disco) - devolve o index.html do mesmo jeito
      fs.readFile(path.join(__dirname, 'index.html'), (e, html) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      });
      return;
    }
    // Arquivo encontrado: devolve ele com o Content-Type correto
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// Sobe o servidor na porta configurada
server.listen(PORT, () => {
  console.log(`Frontend rodando em http://localhost:${PORT}`);
});
