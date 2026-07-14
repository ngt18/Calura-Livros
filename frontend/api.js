const API = 'http://localhost:3031';
const REQUEST_TIMEOUT_MS = 8000;

let authToken = null;

function setAuthToken(token) {
  authToken = token;
}

function clearAuthToken() {
  authToken = null;
}

async function apiReq(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (res.status === 204) return null;

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }

    if (!res.ok) {
      throw new Error(data?.error || data?.message || text || `Erro HTTP ${res.status}`);
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('A API demorou para responder. Tente novamente em alguns segundos.');
    }

    if (error instanceof SyntaxError) {
      throw new Error('A API retornou uma resposta inválida.');
    }

    if (error instanceof TypeError) {
      throw new Error('Não foi possível conectar na API. Verifique se o backend está rodando na porta 3031.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchBooks() {
  return await apiReq('/books');
}

async function fetchBookById(id) {
  return await apiReq(`/books/${id}`);
}

async function createBook(book) {
  return await apiReq('/books', {
    method: 'POST',
    body: JSON.stringify(book),
  });
}

async function updateBook(id, data) {
  return await apiReq(`/books/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function deleteBook(id) {
  return await apiReq(`/books/${id}`, { method: 'DELETE' });
}

async function fetchUsers() {
  return await apiReq('/users');
}

async function createUser(data) {
  return await apiReq('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function updateUser(id, data) {
  return await apiReq(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function deleteUser(id) {
  return await apiReq(`/users/${id}`, { method: 'DELETE' });
}

async function fetchReservations() {
  return await apiReq('/reservations');
}

async function createReservation(data) {
  return await apiReq('/reservations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function updateReservation(id, status) {
  return await apiReq(`/reservations/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

async function updateReservationDates(id, dates) {
  return await apiReq(`/reservations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dates),
  });
}

async function deleteReservation(id) {
  return await apiReq(`/reservations/${id}`, { method: 'DELETE' });
}

async function loginUser(email, senha) {
  return await apiReq('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
}
