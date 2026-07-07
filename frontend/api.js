const API = 'http://localhost:3031';

async function apiReq(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Erro na requisicao');
  return data;
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

async function deleteReservation(id) {
  return await apiReq(`/reservations/${id}`, { method: 'DELETE' });
}

async function loginUser(email) {
  const users = await fetchUsers();
  const user = users.find(u => u.email === email);
  if (!user) throw new Error('Usuario nao encontrado');
  return user;
}
