// ================================================================
//  Calura Livros - Cliente HTTP da API
//  Este arquivo é o "carteiro" do frontend: é o único lugar que fala
//  diretamente com o backend (Node/Express, rodando na porta 3031).
//  As telas do app.js nunca usam fetch() direto - sempre chamam uma
//  função daqui (fetchBooks, createUser, loginUser...).
// ================================================================

// Endereço base do backend (API Node/Express)
const API = 'http://localhost:3031';
// Tempo máximo (em ms) que esperamos por uma resposta antes de desistir
const REQUEST_TIMEOUT_MS = 8000;

// Token JWT do usuário logado, guardado em memória (some se a página for
// recarregada; quem persiste entre recarregamentos é o app.js, via localStorage)
let authToken = null;

// Guarda o token para ser enviado automaticamente nas próximas requisições
function setAuthToken(token) {
  authToken = token;
}

// Apaga o token guardado (usado no logout)
function clearAuthToken() {
  authToken = null;
}

// ================================================================
//  FUNÇÃO CENTRAL: apiReq
//  Todas as outras funções deste arquivo (fetchBooks, createUser,
//  loginUser...) passam por aqui - é quem realmente chama fetch().
//  Ela cuida de: timeout manual, headers automáticos (JSON + token),
//  resposta 204 sem corpo, parse defensivo do JSON, erro HTTP tratado
//  na mão e tradução de erros técnicos em mensagens amigáveis.
// ================================================================
async function apiReq(path, options = {}) {
  // fetch() não tem timeout nativo: criamos um AbortController e o
  // programamos para abortar a requisição sozinho após REQUEST_TIMEOUT_MS
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // Headers enviados em toda chamada: JSON por padrão, o token de login
  // (se houver) e por cima os headers extras que a chamada quiser somar
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers || {}),
  };

  try {
    // Dispara a requisição de verdade, ligando-a ao controller acima
    // (é o que faz o abort() do timeout conseguir cancelar o fetch)
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    // 204 = sucesso sem conteúdo (ex.: um DELETE que deu certo) - não há
    // corpo para ler na resposta
    if (res.status === 204) return null;

    // Lê como texto puro em vez de usar res.json() direto, porque o corpo
    // pode vir vazio - e chamar .json() num corpo vazio geraria uma exceção
    const text = await res.text();
    let data = null;
    try {
      // Parse defensivo: se vier vazio ou um JSON inválido, não deixa a
      // aplicação quebrar - apenas segue com data = null
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }

    // IMPORTANTE: fetch() só rejeita (cai no catch) em erro de REDE.
    // Erros HTTP (400, 401, 404, 500...) chegam normalmente aqui em `res`,
    // então precisamos checar "res.ok" na mão e lançar o erro nós mesmos,
    // usando a mensagem que o próprio backend mandou, quando existir
    if (!res.ok) {
      throw new Error(data?.error || data?.message || text || `Erro HTTP ${res.status}`);
    }

    return data;
  } catch (error) {
    // A partir daqui, traduzimos erros técnicos em mensagens que fazem
    // sentido para quem está usando o site
    if (error.name === 'AbortError') {
      // O controller.abort() do timeout cai exatamente aqui
      throw new Error('A API demorou para responder. Tente novamente em alguns segundos.');
    }

    if (error instanceof SyntaxError) {
      // Alguma tentativa de interpretar a resposta como JSON falhou
      throw new Error('A API retornou uma resposta inválida.');
    }

    if (error instanceof TypeError) {
      // TypeError é o que o fetch lança quando nem consegue falar com o
      // servidor (backend desligado, porta errada, sem rede, CORS...)
      throw new Error('Não foi possível conectar na API. Verifique se o backend está rodando na porta 3031.');
    }

    // Qualquer outro erro, não previsto acima, sobe sem tradução
    throw error;
  } finally {
    // Sempre cancela o timer do timeout, tenha a requisição dado certo ou não
    clearTimeout(timeoutId);
  }
}

// ================================================================
//  LIVROS (BOOKS)
//  Wrappers finos: cada função só chama apiReq() com o método e a
//  rota certos, para quem for mexer no catálogo de livros
// ================================================================

// Lista todos os livros do catálogo
async function fetchBooks() {
  return await apiReq('/books');
}

// Busca um único livro pelo id
async function fetchBookById(id) {
  return await apiReq(`/books/${id}`);
}

// Cadastra um novo livro
async function createBook(book) {
  return await apiReq('/books', {
    method: 'POST',
    body: JSON.stringify(book),
  });
}

// Atualiza os dados de um livro existente
async function updateBook(id, data) {
  return await apiReq(`/books/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Remove um livro
async function deleteBook(id) {
  return await apiReq(`/books/${id}`, { method: 'DELETE' });
}

// ================================================================
//  USUÁRIOS (USERS)
//  Cadastro/consulta de usuários - usado principalmente na área admin
// ================================================================

// Lista todos os usuários cadastrados
async function fetchUsers() {
  return await apiReq('/users');
}

// Cadastra um novo usuário
async function createUser(data) {
  return await apiReq('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Atualiza dados de um usuário (ex.: nome, email, virar admin)
async function updateUser(id, data) {
  return await apiReq(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Remove um usuário
async function deleteUser(id) {
  return await apiReq(`/users/${id}`, { method: 'DELETE' });
}

// ================================================================
//  RESERVAS (EMPRÉSTIMOS)
// ================================================================

// Lista todas as reservas/empréstimos
async function fetchReservations() {
  return await apiReq('/reservations');
}

// Cria uma nova reserva (usuário pede um livro emprestado)
async function createReservation(data) {
  return await apiReq('/reservations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Atualiza só o status da reserva (ex.: devolvido, cancelada)
async function updateReservation(id, status) {
  return await apiReq(`/reservations/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// Atualiza as datas da reserva (usado pelo admin para corrigir prazos)
async function updateReservationDates(id, dates) {
  return await apiReq(`/reservations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dates),
  });
}

// Remove uma reserva
async function deleteReservation(id) {
  return await apiReq(`/reservations/${id}`, { method: 'DELETE' });
}

// ================================================================
//  AUTENTICAÇÃO
// ================================================================

// Faz login: envia email/senha e recebe de volta o usuário + token JWT
async function loginUser(email, senha) {
  return await apiReq('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
}
