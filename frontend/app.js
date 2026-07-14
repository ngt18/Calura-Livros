const CATEGORIES = ['Todos', 'Fantasia', 'Literatura Brasileira', 'Tecnologia', 'História', 'Ficção Científica', 'Infantojuvenil', 'Autoajuda'];
const COVER_DEFAULT = 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=420&fit=crop&auto=format';
const STATUS_MAP = {
  ATIVA: 'active',
  ATRASADA: 'overdue',
  DEVOLVIDO: 'returned',
  CANCELADA: 'cancelled',
};
const STATUS_LABELS = {
  active: 'Ativo',
  overdue: 'Atrasado',
  returned: 'Devolvido',
  cancelled: 'Cancelado',
};

const SESSION_KEY = 'calura_session';

function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    user: state.user,
    isAdmin: state.isAdmin,
    token: state.token,
  }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function restoreSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (session.token) setAuthToken(session.token);
    return session;
  } catch {
    clearSession();
    return null;
  }
}

const savedSession = restoreSession();

const state = {
  screen: savedSession ? 'dashboard' : 'login',
  isAdmin: savedSession?.isAdmin || false,
  user: savedSession?.user || null,
  token: savedSession?.token || null,
  books: [],
  loans: [],
  users: [],
  selectedBook: null,
  sidebarOpen: false,
  loading: false,
  _apiOffline: false,
};

// ─── Routes ────────────────────────────────────────────────────────

const routes = {
  '/login': 'login',
  '/catalogo': 'dashboard',
  '/minhas-reservas': 'my-loans',
  '/perfil': 'profile',
  '/livro': 'book-detail',
  '/admin': 'admin-dashboard',
  '/admin/livros': 'admin-books',
  '/admin/usuarios': 'admin-users',
  '/admin/reservas': 'admin-loans',
};

const screenToPath = Object.fromEntries(
  Object.entries(routes).map(([k, v]) => [v, k])
);

function navigate(screen) {
  if (screen.startsWith('admin-') && !state.isAdmin) {
    state.screen = 'login';
    history.replaceState({ screen: 'login' }, '', '/login');
    render();
    return;
  }
  state.screen = screen;
  state.sidebarOpen = false;
  const path = screenToPath[screen] || '/';
  history.pushState({ screen }, '', path);
  render();
}

window.addEventListener('popstate', () => {
  const path = window.location.pathname;
  const screen = routes[path];
  if (!screen) {
    history.replaceState({ screen: 'login' }, '', '/login');
    state.screen = 'login';
    render();
    return;
  }
  if (screen.startsWith('admin-') && !state.isAdmin) {
    history.replaceState({ screen: 'login' }, '', '/login');
    state.screen = 'login';
    render();
    return;
  }
  if (screen === 'book-detail' && !state.selectedBook) {
    navigate('dashboard');
    return;
  }
  state.screen = screen;
  render();
});

function showToast(msg, isError) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' toast-error' : '');
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${isError ? '#ef4444' : '#10b981'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${isError
      ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
      : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'}</svg>
    <span>${msg}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function showError(msg) {
  showToast(msg, true);
}

function showConfirmModal(msg) {
  return new Promise((resolve) => {
    const existing = document.querySelector('.confirm-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    overlay.innerHTML = `
      <div class="confirm-modal">
        <p>${msg}</p>
        <div class="confirm-actions">
          <button class="btn btn-primary" id="confirm-yes">Sim</button>
          <button class="btn btn-ghost" id="confirm-no">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('confirm-yes').onclick = () => { overlay.remove(); resolve(true); };
    document.getElementById('confirm-no').onclick = () => { overlay.remove(); resolve(false); };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

function formatDate(value) {
  if (!value) return '';
  return String(value).split('T')[0];
}

function displayDate(value) {
  if (!value) return '-';
  const parts = String(value).split('T')[0].split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function todayLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function calcLoanDays(paginas) {
  const p = Number(paginas) || 0;
  if (p <= 150) return 7;
  if (p <= 300) return 10;
  if (p <= 500) return 15;
  return 20;
}

function computeStatus(loan) {
  if (loan.status === 'returned' || loan.status === 'cancelled') return loan.status;
  if (loan.dataDevolucao) return 'returned';
  if (!loan.dataPrevista) return 'active';
  if (todayLocal() > loan.dataPrevista) return 'overdue';
  return 'active';
}

function getDaysDiff(targetDate) {
  if (!targetDate) return 0;
  const hoje = new Date(todayLocal() + 'T23:59:59');
  const target = new Date(targetDate + 'T23:59:59');
  return Math.ceil((target - hoje) / (1000 * 60 * 60 * 24));
}

function daysInfo(loan) {
  const computed = computeStatus(loan);
  if (computed === 'returned' || computed === 'cancelled') return '';
  if (computed === 'overdue') {
    const diff = getDaysDiff(loan.dataPrevista);
    return `<span style="color:var(--red-600);font-size:12px;font-weight:500">${Math.abs(diff)} dias em atraso</span>`;
  }
  const diff = getDaysDiff(loan.dataPrevista);
  return `<span style="color:var(--blue-600);font-size:12px;font-weight:500">${diff} dias restantes</span>`;
}

function statusBadge(status) {
  const className = status === 'active'
    ? 'badge-blue'
    : status === 'overdue'
      ? 'badge-red'
      : status === 'cancelled'
        ? 'badge-yellow'
        : 'badge-slate';
  return `<span class="badge ${className}">${STATUS_LABELS[status] || status}</span>`;
}

function icon(name) {
  const icons = {
    book: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    clipboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
    user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    arrowLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    arrowRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    star: '<svg width="12" height="12" viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    alertCircle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    clock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    bookCopy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    trending: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    eye: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    edit: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    settings: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    refresh: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    eyeOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    eyeOn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    spinner: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg>',
  };
  return icons[name] || '';
}

function mapBook(b) {
  return {
    id: b.id_livro,
    title: b.titulo || 'Sem título',
    author: b.autor || 'Desconhecido',
    paginas: Number(b.paginas) || 0,
    available: Number(b.disponivel) ? 1 : 0,
    total: 1,
    cover: b.imagem || COVER_DEFAULT,
  };
}

function mapReservation(r) {
  const rawStatus = String(r.status || 'ATIVA').toUpperCase();
  return {
    id: r.id_reserva,
    bookId: r.id_livro,
    userId: r.id_usuario,
    bookTitle: r.livro_titulo || 'Livro',
    borrowDate: formatDate(r.data_reserva),
    dataEmprestimo: formatDate(r.data_emprestimo),
    dataPrevista: formatDate(r.data_prevista),
    dueDate: r.data_prevista || null,
    dataDevolucao: formatDate(r.data_devolucao),
    status: STATUS_MAP[rawStatus] || 'active',
  };
}

async function loadData() {
  state.loading = true;
  renderContent();
  let hasError = false;
  try {
    const [books, reservations, users] = await Promise.all([
      fetchBooks().catch(() => { hasError = true; return []; }),
      fetchReservations().catch(() => { hasError = true; return []; }),
      fetchUsers().catch(() => { hasError = true; return []; }),
    ]);
    state.books = books.map(mapBook);
    state.loans = reservations.map(mapReservation);
    state.users = users;
    if (hasError && state.books.length === 0) {
      state._apiOffline = true;
    } else {
      state._apiOffline = false;
    }
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
    state._apiOffline = true;
  } finally {
    state.loading = false;
    renderContent();
  }
}

async function handleLogin(email, senha) {
  try {
    const user = await loginUser(email, senha);
    if (!user) { showError('Resposta inválida do servidor'); return; }
    state.user = { id: user.id_usuario, nome: user.nome, email: user.email };
    state.isAdmin = Boolean(user.is_admin);
    state.token = user.token;
    setAuthToken(user.token);
    saveSession();
    await loadData();
    navigate(state.isAdmin ? 'admin-dashboard' : 'dashboard');
  } catch (e) {
    showError(e.message);
  }
}

function handleLogout() {
  state.user = null;
  state.isAdmin = false;
  state.token = null;
  state.books = [];
  state.loans = [];
  state.users = [];
  state.selectedBook = null;
  state._apiOffline = false;
  clearAuthToken();
  clearSession();
  navigate('login');
}

function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  render();
}

function renderLoading() {
  return '<div style="display:flex;justify-content:center;align-items:center;padding:64px;color:var(--slate-400)">' + icon('spinner') + ' <span style="margin-left:12px">Carregando…</span></div>';
}

// ─── Render ───────────────────────────────────────────────────────

function render() {
  const app = document.getElementById('app');
  if (state.screen === 'login') {
    app.innerHTML = renderLogin();
    bindLogin();
  } else {
    app.innerHTML = renderLayout();
    bindLayout();
  }
}

// ─── Login ────────────────────────────────────────────────────────

function renderLogin() {
  return `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <div class="logo-box">${icon('book')}</div>
          <h1>Calura<span>Livros</span></h1>
          <p>Sistema de Gestão de Biblioteca</p>
        </div>
        <div class="login-box">
          <div class="login-tabs">
            <button class="active" id="tab-login">Entrar</button>
            <button id="tab-register">Criar conta</button>
          </div>
          <div id="login-form" class="login-form">
            <div class="input-group">
              <label>E-mail</label>
              <div class="input-wrapper">
                <span class="input-icon">${icon('user')}</span>
                <input type="email" id="login-email" class="has-icon" placeholder="seu@email.com" />
              </div>
            </div>
            <div class="input-group">
              <label>Senha</label>
              <div class="input-wrapper">
                <span class="input-icon">${icon('book')}</span>
                <input type="password" id="login-pass" class="has-icon" placeholder="Digite sua senha" />
                <button id="toggle-pass" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--slate-400);cursor:pointer;">${icon('eyeOff')}</button>
              </div>
            </div>
            <button class="btn btn-primary btn-lg" id="btn-login" style="width:100%">Entrar</button>
          </div>
          <div id="register-form" class="login-form" style="display:none">
            <div class="input-group">
              <label>Nome completo</label>
              <div class="input-wrapper">
                <span class="input-icon">${icon('user')}</span>
                <input type="text" id="reg-name" class="has-icon" placeholder="Seu nome" />
              </div>
            </div>
            <div class="input-group">
              <label>E-mail institucional</label>
              <div class="input-wrapper">
                <span class="input-icon">${icon('user')}</span>
                <input type="email" id="reg-email" class="has-icon" placeholder="seu@email.com" />
              </div>
            </div>
            <div class="input-group">
              <label>Senha</label>
              <div class="input-wrapper">
                <span class="input-icon">${icon('book')}</span>
                <input type="password" id="reg-pass" class="has-icon" placeholder="Mínimo de 6 caracteres" />
              </div>
            </div>
            <button class="btn btn-primary btn-lg" id="btn-register" style="width:100%">Criar conta</button>
          </div>
        </div>
        <p class="login-footer">2025 CaluraLivros - Todos os direitos reservados</p>
      </div>
    </div>
  `;
}

function bindLogin() {
  const tabLogin = document.getElementById('tab-login');
  const tabReg = document.getElementById('tab-register');
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');

  if (tabLogin) tabLogin.onclick = () => {
    tabLogin.classList.add('active');
    if (tabReg) tabReg.classList.remove('active');
    if (loginForm) loginForm.style.display = '';
    if (regForm) regForm.style.display = 'none';
  };
  if (tabReg) tabReg.onclick = () => {
    tabReg.classList.add('active');
    if (tabLogin) tabLogin.classList.remove('active');
    if (regForm) regForm.style.display = '';
    if (loginForm) loginForm.style.display = 'none';
  };

  const togglePass = document.getElementById('toggle-pass');
  if (togglePass) togglePass.onclick = () => {
    const inp = document.getElementById('login-pass');
    if (inp) {
      if (inp.type === 'password') { inp.type = 'text'; togglePass.innerHTML = icon('eyeOn'); }
      else { inp.type = 'password'; togglePass.innerHTML = icon('eyeOff'); }
    }
  };

  const btnLogin = document.getElementById('btn-login');
  if (btnLogin) btnLogin.onclick = () => {
    const email = document.getElementById('login-email');
    const senha = document.getElementById('login-pass');
    if (!email || !senha) return;
    const e = email.value.trim();
    const s = senha.value;
    if (!e || !s) { showError('Digite e-mail e senha'); return; }
    if (!e.includes('@')) { showError('Digite um e-mail válido'); return; }
    handleLogin(e, s);
  };

  const btnRegister = document.getElementById('btn-register');
  if (btnRegister) btnRegister.onclick = async () => {
    const nome = document.getElementById('reg-name');
    const email = document.getElementById('reg-email');
    const senha = document.getElementById('reg-pass');
    if (!nome || !email || !senha) return;
    const n = nome.value.trim();
    const e = email.value.trim();
    const s = senha.value;
    if (!n || !e || !s) { showError('Preencha todos os campos'); return; }
    if (s.length < 6) { showError('A senha deve ter pelo menos 6 caracteres'); return; }
    if (!e.includes('@')) { showError('Digite um e-mail válido'); return; }
    try {
      await createUser({ nome: n, email: e, senha: s });
      await handleLogin(e, s);
    } catch (err) {
      showError(err.message);
    }
  };
}

// ─── Layout ───────────────────────────────────────────────────────

function renderLayout() {
  const s = state.screen;
  const titles = {
    dashboard: 'Catálogo',
    'book-detail': 'Detalhes do Livro',
    'my-loans': 'Minhas Reservas',
    profile: 'Perfil',
    'admin-dashboard': 'Dashboard',
    'admin-books': 'Gestão de Livros',
    'admin-users': 'Usuários',
    'admin-loans': 'Reservas',
  };

  return `
    <div class="app-layout">
      ${renderSidebar()}
      <div class="app-main">
        <header class="topbar">
          <div class="topbar-left">
            <button class="topbar-menu" id="menu-btn">${icon('menu')}</button>
            <h1>${titles[s] || 'Calura Livros'}</h1>
          </div>
          <div class="topbar-right">
            <button class="topbar-bell">
              ${icon('bell')}
              ${state.loans.filter(l => l.status === 'active' || l.status === 'overdue').length > 0 ? '<span class="dot"></span>' : ''}
            </button>
            <div class="topbar-user">
              <div class="topbar-avatar">${state.user?.nome?.[0] || 'A'}</div>
              <div class="topbar-user-info">
                <div class="name">${state.user?.nome || 'Usuário'}</div>
                <div class="role">${state.isAdmin ? 'Administrador' : 'Estudante'}</div>
              </div>
            </div>
          </div>
        </header>
        <main class="app-content" id="content"></main>
      </div>
      ${state.sidebarOpen ? '<div class="overlay" id="overlay"></div>' : ''}
    </div>
  `;
}

function renderSidebar() {
  const s = state.screen;
  const userNav = [
    { icon: 'home', label: 'Início', screen: 'dashboard' },
    { icon: 'clipboard', label: 'Minhas Reservas', screen: 'my-loans' },
    { icon: 'user', label: 'Perfil', screen: 'profile' },
  ];
  const adminNav = [
    { icon: 'home', label: 'Catálogo', screen: 'dashboard' },
    { icon: 'dashboard', label: 'Painel', screen: 'admin-dashboard' },
    { icon: 'book', label: 'Livros', screen: 'admin-books' },
    { icon: 'users', label: 'Usuários', screen: 'admin-users' },
    { icon: 'clipboard', label: 'Reservas', screen: 'admin-loans' },
  ];
  const nav = state.isAdmin ? adminNav : userNav;

  return `
    <aside class="sidebar ${state.sidebarOpen ? 'open' : ''}">
      <div class="sidebar-logo">
        <div class="logo-icon">${icon('book')}</div>
        <span class="logo-text">Calura<span>Livros</span></span>
      </div>
      <nav class="sidebar-nav">
        ${state.isAdmin ? '<p class="nav-label">Administração</p>' : ''}
        ${nav.map(item => `
          <button class="${s === item.screen ? 'active' : ''}" data-nav="${item.screen}">
            ${icon(item.icon)} ${item.label}
          </button>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        ${state.isAdmin ? `<div class="admin-badge">${icon('settings')} Modo Administrador</div>` : ''}
        <button class="logout-btn" id="btn-logout">${icon('logout')} Sair</button>
      </div>
    </aside>
  `;
}

function bindLayout() {
  const menuBtn = document.getElementById('menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.addEventListener('click', () => { state.sidebarOpen = false; render(); });
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  const bellBtn = document.querySelector('.topbar-bell');
  if (bellBtn) bellBtn.addEventListener('click', toggleNotifications);

  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });

  renderContent();
}

function renderNotifications() {
  const loans = state.loans;
  const pending = loans.filter(l => l.status === 'active' || l.status === 'overdue');
  if (pending.length === 0) {
    return `<div class="notif-empty">Nenhuma notificação</div>`;
  }
  return pending.map(l => {
    const isOverdue = l.status === 'overdue';
    return `
      <div class="notif-item ${isOverdue ? 'notif-overdue' : ''}">
        <div class="notif-icon">${icon(isOverdue ? 'alertCircle' : 'clock')}</div>
        <div class="notif-body">
          <div class="notif-title">${l.bookTitle || 'Livro'}</div>
          <div class="notif-desc">${isOverdue ? 'Atrasado - prazo excedido' : 'Empréstimo ativo'}</div>
          <div class="notif-date">Devolução: ${l.dueDate ? new Date(l.dueDate).toLocaleDateString('pt-BR') : '—'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleNotifications() {
  const existing = document.querySelector('.notif-dropdown');
  if (existing) { existing.remove(); return; }

  const bell = document.querySelector('.topbar-bell');
  if (!bell) return;
  const rect = bell.getBoundingClientRect();

  const dropdown = document.createElement('div');
  dropdown.className = 'notif-dropdown';
    dropdown.innerHTML = `
    <div class="notif-header">Notificações</div>
    <div class="notif-list">${renderNotifications()}</div>
  `;
  dropdown.style.top = (rect.bottom + 8) + 'px';
  dropdown.style.right = (window.innerWidth - rect.right) + 'px';
  document.body.appendChild(dropdown);

  setTimeout(() => {
    document.addEventListener('click', closeNotif, { once: true });
  }, 0);

  function closeNotif(e) {
    if (!dropdown.contains(e.target) && e.target !== bell) {
      dropdown.remove();
    } else {
      document.addEventListener('click', closeNotif, { once: true });
    }
  }
}

// ─── Content Router ───────────────────────────────────────────────

function renderContent() {
  const c = document.getElementById('content');
  if (!c) return;
  if (state.loading) {
    c.innerHTML = renderLoading();
    return;
  }
  if (state._apiOffline) {
    c.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px;text-align:center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red-500)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h2 style="margin-top:16px;color:var(--slate-700)">API Indisponível</h2>
        <p style="color:var(--slate-400);margin-top:8px">Nao foi possivel conectar ao servidor. Verifique se o backend esta rodando na porta 3031.</p>
        <button class="btn btn-primary" style="margin-top:20px" onclick="loadData()">Tentar novamente</button>
      </div>
    `;
    return;
  }
  switch (state.screen) {
    case 'dashboard': c.innerHTML = renderDashboard(); bindDashboard(); break;
    case 'book-detail': c.innerHTML = renderBookDetail(); bindBookDetail(); break;
    case 'my-loans': c.innerHTML = renderMyLoans(); bindMyLoans(); break;
    case 'profile': c.innerHTML = renderProfile(); bindProfile(); break;
    case 'admin-dashboard': c.innerHTML = renderAdminDashboard(); bindAdminDashboard(); break;
    case 'admin-books': c.innerHTML = renderAdminBooks(); bindAdminBooks(); break;
    case 'admin-users': c.innerHTML = renderAdminUsers(); bindAdminUsers(); break;
    case 'admin-loans': c.innerHTML = renderAdminLoans(); bindAdminLoans(); break;
  }
}

// ─── Dashboard ────────────────────────────────────────────────────

function renderDashboard() {
  const books = state.books;
  const stats = {
    total: books.length,
    available: books.filter(b => b.available > 0).length,
    loaned: books.filter(b => b.available === 0).length,
    myActive: state.user ? state.loans.filter(l => l.userId === state.user.id && computeStatus(l) === 'active').length : 0,
  };
  const initialPage = books.slice(0, 50);

  return `
    <div class="dash-hero">
      <h2>Olá, ${state.user?.nome?.split(' ')[0] || 'Visitante'}!</h2>
      <p>O que você quer ler hoje?</p>
      <div class="search-box">
        ${icon('search')}
        <input type="text" id="search-input" placeholder="Buscar por título ou autor..." />
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon blue">${icon('book')}</div>
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">Livros no Acervo</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">${icon('check')}</div>
        <div class="stat-value">${stats.available}</div>
        <div class="stat-label">Disponíveis</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">${icon('bookCopy')}</div>
        <div class="stat-value">${stats.loaned}</div>
        <div class="stat-label">Emprestados</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">${icon('clipboard')}</div>
        <div class="stat-value">${stats.myActive}</div>
        <div class="stat-label">Meus Ativos</div>
      </div>
    </div>
    <div class="category-bar" id="cat-bar">
      ${CATEGORIES.map(c => `<button class="${c === 'Todos' ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('')}
    </div>
    <section>
      <div class="section-header">
        <h2 id="catalog-title">Catálogo <span>(${books.length} livros)</span></h2>
      </div>
      <div class="books-grid" id="books-grid">
        ${initialPage.length === 0
          ? `<div class="empty-state" style="grid-column:1/-1">${icon('book')}<p>Nenhum livro encontrado</p></div>`
          : initialPage.map(renderBookCard).join('')
        }
      </div>
      <div id="pagination"></div>
    </section>
  `;
}

function renderBookCard(book) {
  const avail = book.available > 0;
  return `
    <div class="book-card" data-book-id="${book.id}">
      <div class="book-cover">
        <img src="${book.cover}" alt="${book.title}" loading="lazy" />
        <span class="cover-badge badge ${avail ? 'badge-green' : 'badge-red'}">${avail ? 'Disponível' : 'Emprestado'}</span>
        <span class="cover-rating">${icon('star')} ${(4 + (book.id % 10) / 10).toFixed(1)}</span>
      </div>
      <div class="book-info">
        <div class="book-category">${CATEGORIES[book.id % CATEGORIES.length] || 'Geral'}</div>
        <div class="book-title">${book.title}</div>
        <div class="book-author">${book.author}</div>
        <div class="book-footer">
          <span class="avail">${book.available}/${book.total} disp.</span>
          <button class="btn btn-sm ${avail ? 'btn-primary' : 'btn-ghost'}" data-borrow="${book.id}" ${!avail ? 'disabled' : ''}>${avail ? 'Reservar' : 'Indisponível'}</button>
        </div>
      </div>
    </div>
  `;
}

function bindDashboard() {
  let searchQuery = '';
  let activeCategory = 'Todos';
  let currentPage = 1;
  const PAGE_SIZE = 50;

  const renderPagination = (totalItems) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const pagEl = document.getElementById('pagination');
    if (!pagEl) return;
    if (totalPages <= 1) { pagEl.innerHTML = ''; return; }
    let html = '<div class="pag-btns">';
    html += `<button class="pag-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>${icon('arrowLeft')} Anterior</button>`;
    html += '<div class="pag-info">Página ' + currentPage + ' de ' + totalPages + '</div>';
    html += `<button class="pag-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Próximo ${icon('arrowRight')}</button>`;
    html += '</div>';
    pagEl.innerHTML = html;

    pagEl.querySelectorAll('.pag-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page, 10);
        filterBooks();
      });
    });
  };

  const filterBooks = () => {
    let list = state.books;
    if (activeCategory !== 'Todos') list = list.filter(b => CATEGORIES[b.id % CATEGORIES.length] === activeCategory);
    if (searchQuery) list = list.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.author.toLowerCase().includes(searchQuery.toLowerCase()));

    const totalFiltered = list.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = list.slice(start, start + PAGE_SIZE);

    const grid = document.getElementById('books-grid');
    const title = document.getElementById('catalog-title');
    if (title) title.innerHTML = searchQuery ? `Resultados para "${searchQuery}" <span>(${totalFiltered} livros)</span>` : `Catálogo <span>(${totalFiltered} livros)</span>`;
    if (grid) grid.innerHTML = pageItems.length === 0
      ? `<div class="empty-state" style="grid-column:1/-1">${icon('book')}<p>Nenhum livro encontrado</p></div>`
      : pageItems.map(renderBookCard).join('');
    bindBookCards();
    renderPagination(totalFiltered);
  };

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('input', e => {
    searchQuery = e.target.value;
    currentPage = 1;
    filterBooks();
  });

  document.querySelectorAll('#cat-bar button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      document.querySelectorAll('#cat-bar button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPage = 1;
      filterBooks();
    });
  });

  function bindBookCards() {
    document.querySelectorAll('.book-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-borrow]')) {
          e.stopPropagation();
          const id = parseInt(e.target.closest('[data-borrow]').dataset.borrow, 10);
          if (!Number.isNaN(id)) handleBorrow(id);
          return;
        }
        const id = parseInt(card.dataset.bookId, 10);
        if (!Number.isNaN(id)) {
          const book = state.books.find(b => b.id === id);
          if (book) { state.selectedBook = book; navigate('book-detail'); }
        }
      });
    });
  }
  bindBookCards();
}

async function handleBorrow(bookId) {
  if (!state.user) return;
  const book = state.books.find(b => b.id === bookId);
  if (!book || book.available === 0) return;
  try {
    await createReservation({
      data_reserva: new Date().toISOString().split('T')[0],
      id_usuario: state.user.id,
      id_livro: bookId,
    });
    showToast('Reserva solicitada com sucesso!');
    await loadData();
    state.selectedBook = state.books.find(b => b.id === bookId) || state.selectedBook;
    if (state.screen === 'dashboard' || state.screen === 'book-detail') renderContent();
  } catch (e) {
    showError(e.message);
  }
}

// ─── Book Detail ──────────────────────────────────────────────────

function renderBookDetail() {
  const book = state.selectedBook;
  if (!book) return '<p>Livro não encontrado</p>';
  const avail = book.available > 0;
  const dias = calcLoanDays(book.paginas);
  return `
    <button class="detail-back" id="btn-back">${icon('arrowLeft')} Voltar ao catálogo</button>
    <div class="detail-card">
      <div class="detail-cover">
        <img src="${book.cover}" alt="${book.title}" />
      </div>
      <div class="detail-info">
        <div class="detail-header">
          <div>
            <span class="badge badge-slate">Geral</span>
            <h2 style="font-size:24px;font-weight:700;color:var(--slate-800);margin-top:8px;line-height:1.3">${book.title}</h2>
            <p style="color:var(--slate-500);margin-top:4px">${book.author}</p>
          </div>
          <div class="detail-rating">${icon('star')} ${(4 + (book.id % 10) / 10).toFixed(1)}</div>
        </div>
        <div class="detail-meta">
          <div class="meta-item"><div class="label">Editora</div><div class="value">-</div></div>
          <div class="meta-item"><div class="label">Ano</div><div class="value">-</div></div>
          <div class="meta-item"><div class="label">ISBN</div><div class="value">-</div></div>
          <div class="meta-item"><div class="label">Páginas</div><div class="value">${book.paginas || '-'}</div></div>
          <div class="meta-item"><div class="label">Prazo de empréstimo</div><div class="value">${dias} dias</div></div>
          <div class="meta-item"><div class="label">Disponíveis</div><div class="value">${book.available} de ${book.total}</div></div>
        </div>
        <div class="detail-synopsis">
          <h3>Sinopse</h3>
          <p>${book.title} está cadastrado no acervo da biblioteca com autoria de ${book.author}. Use a disponibilidade abaixo para solicitar a reserva quando houver exemplar livre.</p>
        </div>
        <div class="avail-bar">
          <div class="avail-header">
            <span>Disponibilidade</span>
            <span>${book.available}/${book.total} exemplares</span>
          </div>
          <div class="avail-track">
            <div class="avail-fill" style="width:${(book.available / book.total) * 100}%"></div>
          </div>
        </div>
        <div class="detail-actions">
          ${avail
            ? `<button class="btn btn-primary btn-lg" id="btn-detail-borrow">${icon('book')} Solicitar Reserva</button>`
            : `<button class="btn btn-secondary btn-lg" disabled>${icon('clock')} Indisponível no momento</button>`
          }
          <button class="btn btn-ghost btn-lg" id="btn-detail-back">${icon('arrowLeft')} Voltar</button>
        </div>
      </div>
    </div>
  `;
}

function bindBookDetail() {
  const btnBack = document.getElementById('btn-back');
  if (btnBack) btnBack.addEventListener('click', () => navigate('dashboard'));
  const btnDetailBack = document.getElementById('btn-detail-back');
  if (btnDetailBack) btnDetailBack.addEventListener('click', () => navigate('dashboard'));
  const btnBorrow = document.getElementById('btn-detail-borrow');
  if (btnBorrow) btnBorrow.addEventListener('click', () => {
    if (state.selectedBook) handleBorrow(state.selectedBook.id);
  });
}

// ─── My Loans ─────────────────────────────────────────────────────

function renderMyLoans() {
  const myLoans = state.user ? state.loans.filter(l => l.userId === state.user.id) : [];
  const loansWithComputed = myLoans.map(l => ({ ...l, _computedStatus: computeStatus(l) }));
  const active = loansWithComputed.filter(l => l._computedStatus === 'active' || l._computedStatus === 'overdue');
  const history = loansWithComputed.filter(l => l._computedStatus === 'returned' || l._computedStatus === 'cancelled');
  const overdueCount = loansWithComputed.filter(l => l._computedStatus === 'overdue').length;

  function findBook(bookId) {
    return state.books.find(b => b.id === bookId) || { title: 'Livro', author: 'Desconhecido', cover: COVER_DEFAULT, paginas: 0 };
  }

  function dateOrFallback(d) {
    return d || '-';
  }

  return `
    <div class="loans-grid loans-summary">
      <div class="stat-card">
        <div class="stat-icon blue">${icon('bookCopy')}</div>
        <div class="stat-value">${active.length}</div>
        <div class="stat-label">Ativos</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">${icon('alertCircle')}</div>
        <div class="stat-value">${overdueCount}</div>
        <div class="stat-label">Atrasados</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">${icon('check')}</div>
        <div class="stat-value">${history.length}</div>
        <div class="stat-label">Devolvidos</div>
      </div>
    </div>
    <section style="margin-bottom:32px">
      <div class="section-header"><h2>Reservas Ativas</h2></div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${active.length === 0 ? '<p style="text-align:center;color:var(--slate-400);padding:24px">Nenhuma reserva ativa</p>' :
          active.map(l => {
            const book = findBook(l.bookId);
            const isOverdue = l._computedStatus === 'overdue';
            return `
              <div class="loan-card ${isOverdue ? 'overdue' : ''}">
                <div class="loan-cover"><img src="${book.cover}" alt="${book.title}" /></div>
                <div class="loan-info">
                  ${statusBadge(l._computedStatus)}
                  ${daysInfo(l)}
                  <h3 style="font-size:14px;font-weight:600;color:var(--slate-800);margin-top:4px">${book.title}</h3>
                  <p style="font-size:12px;color:var(--slate-500)">${book.author}</p>
                  <div class="loan-dates">
                    ${l.dataEmprestimo ? `<span>Retirada: ${displayDate(l.dataEmprestimo)}</span>` : l.borrowDate && l.borrowDate !== '-' ? `<span>Retirada: ${displayDate(l.borrowDate)}</span>` : ''}
                    ${l.dataPrevista ? `<span class="${isOverdue ? 'overdue-date' : ''}">Prevista: ${displayDate(l.dataPrevista)}</span>` : ''}
                  </div>
                </div>
                ${l._computedStatus === 'overdue' || l._computedStatus === 'active' ? `<button class="btn btn-sm btn-success" data-return-reservation="${l.id}">${icon('check')} Devolver</button>` : ''}
              </div>
            `;
          }).join('')
        }
      </div>
    </section>
    <section>
      <div class="section-header"><h2>Histórico</h2></div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${history.length === 0 ? '<p style="text-align:center;color:var(--slate-400);padding:24px">Nenhum histórico</p>' :
          history.map(l => {
            const book = findBook(l.bookId);
            return `
              <div class="loan-card" style="opacity:0.6">
                <div class="loan-cover"><img src="${book.cover}" alt="${book.title}" style="filter:grayscale(1)" /></div>
                <div class="loan-info">
                  ${statusBadge(l._computedStatus)}
                  <h3 style="font-size:14px;font-weight:600;color:var(--slate-700);margin-top:4px">${book.title}</h3>
                  <p style="font-size:12px;color:var(--slate-400)">${displayDate(l.borrowDate)}</p>
                  ${l.dataDevolucao ? `<p style="font-size:12px;color:var(--slate-400)">Devolvido: ${displayDate(l.dataDevolucao)}</p>` : ''}
                </div>
              </div>
            `;
          }).join('')
        }
      </div>
    </section>
  `;
}

function bindMyLoans() {
  document.querySelectorAll('[data-return-reservation]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await showConfirmModal('Devolver esta reserva?');
      if (!ok) return;
      try {
        const id = parseInt(btn.dataset.returnReservation, 10);
        if (Number.isNaN(id)) { showError('Erro interno'); return; }
        await updateReservation(id, 'DEVOLVIDO');
        showToast('Reserva devolvida!');
        await loadData();
        renderContent();
      } catch (e) {
        showError(e.message);
      }
    });
  });
}

// ─── Profile ──────────────────────────────────────────────────────

function renderProfile() {
  const u = state.user;
  const myLoans = state.loans.filter(l => l.userId === u?.id);
  const activeCount = myLoans.filter(l => computeStatus(l) === 'active').length;
  const overdueCount = myLoans.filter(l => computeStatus(l) === 'overdue').length;

  return `
    <div style="max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:20px">
      <div class="profile-hero">
        <div class="profile-avatar">${u?.nome?.[0] || 'A'}</div>
        <div>
          <h2>${u?.nome || 'Usuário'}</h2>
          <p class="course">Estudante</p>
          <p class="email">${u?.email || ''}</p>
        </div>
      </div>
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card">
          <div class="stat-icon blue">${icon('bookCopy')}</div>
          <div class="stat-value">${activeCount + overdueCount}</div>
          <div class="stat-label">Emprestados</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">${icon('clipboard')}</div>
          <div class="stat-value">${myLoans.length}</div>
          <div class="stat-label">Histórico</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon yellow">${icon('alertCircle')}</div>
          <div class="stat-value">${overdueCount}</div>
          <div class="stat-label">Atrasados</div>
        </div>
      </div>
      <div class="card profile-info">
        <h3>Informações Pessoais</h3>
        <div class="profile-field"><span class="label">Nome</span><span class="value">${u?.nome || '-'}</span></div>
        <div class="profile-field"><span class="label">E-mail</span><span class="value">${u?.email || '-'}</span></div>
        <div class="profile-field"><span class="label">ID</span><span class="value">${u?.id || '-'}</span></div>
      </div>
      <button class="btn btn-danger btn-lg" id="btn-profile-logout" style="width:100%">${icon('logout')} Sair da conta</button>
    </div>
  `;
}

function bindProfile() {
  const btn = document.getElementById('btn-profile-logout');
  if (btn) btn.addEventListener('click', handleLogout);
}

// ─── Admin Dashboard ──────────────────────────────────────────────

function renderAdminDashboard() {
  const books = state.books;
  const loans = state.loans;
  const activeLoans = loans.filter(l => computeStatus(l) === 'active');
  const overdueLoans = loans.filter(l => computeStatus(l) === 'overdue');
  const recentLoans = [...loans].sort((a, b) => {
    const da = a.dataEmprestimo || a.borrowDate || '';
    const db = b.dataEmprestimo || b.borrowDate || '';
    return db.localeCompare(da);
  }).slice(0, 4);

  return `
    <div class="admin-hero">
      <h2>Painel Administrativo</h2>
      <p>Gestão completa do acervo e usuários</p>
      <div class="hero-actions">
        <button class="btn btn-yellow btn-sm" data-nav="admin-books">${icon('plus')} Novo Livro</button>
        <button class="btn btn-ghost btn-sm" style="color:rgba(255,255,255,0.7)" data-nav="admin-users">${icon('users')} Usuários</button>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon blue">${icon('book')}</div><div class="stat-value">${books.length}</div><div class="stat-label">Total de Livros</div></div>
      <div class="stat-card"><div class="stat-icon yellow">${icon('bookCopy')}</div><div class="stat-value">${books.filter(b => b.available === 0).length}</div><div class="stat-label">Livros Emprestados</div></div>
      <div class="stat-card"><div class="stat-icon green">${icon('users')}</div><div class="stat-value">${state.users.length}</div><div class="stat-label">Usuários Cadastrados</div></div>
      <div class="stat-card"><div class="stat-icon purple">${icon('trending')}</div><div class="stat-value">${activeLoans.length}</div><div class="stat-label">Reservas Ativas</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card recent-loans-card" style="padding:20px">
        <div class="card-header">
          <h3>Reservas Recentes</h3>
          <a href="#" data-nav="admin-loans" style="cursor:pointer">Ver todos</a>
        </div>
        <div>
          ${recentLoans.map(l => {
            const computed = computeStatus(l);
            const book = state.books.find(b => b.id === l.bookId) || { title: 'Livro', author: '?' };
              const user = state.users.find(u => u.id_usuario === l.userId) || { nome: 'Usuário' };
            const dateLabel = displayDate(l.dataEmprestimo || l.borrowDate);
            return `
              <div class="recent-item">
                <div class="recent-avatar">${user.nome[0]}</div>
                <div class="recent-info">
                  <div class="name">${user.nome}</div>
                  <div class="detail">${book.title} - ${dateLabel}</div>
                </div>
                ${statusBadge(computed)}
              </div>
            `;
          }).join('') || '<p style="text-align:center;color:var(--slate-400);padding:16px">Nenhuma reserva</p>'}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="card" style="padding:20px">
          <h3 style="font-size:16px;font-weight:600;margin-bottom:12px">Ações Rápidas</h3>
          <div class="quick-actions">
            <button class="btn btn-primary btn-sm" data-nav="admin-books" style="justify-content:flex-start">${icon('plus')} Cadastrar Livro</button>
            <button class="btn btn-secondary btn-sm" data-nav="admin-users" style="justify-content:flex-start">${icon('users')} Ver Usuários</button>
            <button class="btn btn-secondary btn-sm" data-nav="admin-loans" style="justify-content:flex-start">${icon('clipboard')} Reservas</button>
            <button class="btn btn-secondary btn-sm" data-nav="admin-dashboard" style="justify-content:flex-start">${icon('trending')} Relatórios</button>
          </div>
        </div>
        <div class="alert-card">
          <div class="alert-icon">${icon('alertCircle')}</div>
          <div>
            <div class="alert-title">${overdueLoans.length || 0} reservas em atraso</div>
            <div class="alert-desc">Devolução automática disponível na tela de reservas.</div>
            <a href="#" class="alert-link" data-nav="admin-loans">Ver detalhes</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindAdminDashboard() {
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); navigate(btn.dataset.nav); });
  });
}

// ─── Admin Books ──────────────────────────────────────────────────

function renderAdminBookRow(b) {
  return `
    <tr data-id="${b.id}">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:44px;border-radius:4px;background:var(--slate-100);overflow:hidden;flex-shrink:0">
            <img src="${b.cover}" alt="" style="width:100%;height:100%;object-fit:cover" />
          </div>
          <span style="font-size:14px;font-weight:500;color:var(--slate-700)">${b.title}</span>
        </div>
      </td>
      <td style="color:var(--slate-500)">${b.author}</td>
      <td style="color:var(--slate-500)">${b.paginas || '-'}</td>
      <td>${b.available}/${b.total}</td>
      <td><span class="badge ${b.available > 0 ? 'badge-green' : 'badge-red'}">${b.available > 0 ? 'Disponível' : 'Esgotado'}</span></td>
      <td>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-secondary" data-edit-book="${b.id}">${icon('edit')} Editar</button>
          <button class="btn btn-sm btn-danger" data-delete="${b.id}">${icon('trash')}</button>
        </div>
      </td>
    </tr>
  `;
}

function renderBookForm(book) {
  const isEdit = Boolean(book);
  return `
    <div class="form-card">
      <h3>${isEdit ? 'Editar Livro' : 'Cadastrar Novo Livro'}</h3>
      <div class="form-grid">
        <div class="input-group"><label>Título</label><div class="input-wrapper"><input type="text" id="form-title" placeholder="Título do livro" value="${book?.title || ''}" /></div></div>
        <div class="input-group"><label>Autor</label><div class="input-wrapper"><input type="text" id="form-author" placeholder="Nome do autor" value="${book?.author || ''}" /></div></div>
        <div class="input-group"><label>Páginas</label><div class="input-wrapper"><input type="number" id="form-paginas" placeholder="Quantidade de páginas" value="${book?.paginas || ''}" min="0" /></div></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:14px;color:var(--slate-600)">
        <input type="checkbox" id="form-available" ${!book || book.available > 0 ? 'checked' : ''} />
        Livro disponível
      </label>
      <div class="form-actions">
        <button class="btn btn-primary" id="btn-save-book">${isEdit ? 'Salvar Alterações' : 'Salvar Livro'}</button>
        <button class="btn btn-ghost" id="btn-cancel-book">Cancelar</button>
      </div>
    </div>
  `;
}

function renderAdminBooks() {
  return `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div style="flex:1">
        <div class="input-wrapper">
          <span class="input-icon">${icon('search')}</span>
          <input type="text" id="admin-search" class="has-icon" placeholder="Buscar livros..." />
        </div>
      </div>
      <button class="btn btn-primary" id="btn-new-book">${icon('plus')} Novo Livro</button>
    </div>
    <div id="book-form-container"></div>
    <div class="card" style="overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--slate-50);display:flex;justify-content:space-between;align-items:center">
        <h3 style="font-size:16px;font-weight:600">Acervo <span style="font-weight:400;font-size:14px;color:var(--slate-400)" id="book-count">(${state.books.length})</span></h3>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Livro</th>
              <th>Autor</th>
              <th>Páginas</th>
              <th>Disponíveis</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="books-tbody">
            ${state.books.map(renderAdminBookRow).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindAdminBooks() {
  const openBookForm = (book = null) => {
    const c = document.getElementById('book-form-container');
    if (!c) return;
    c.innerHTML = renderBookForm(book);

    const btnCancel = document.getElementById('btn-cancel-book');
    if (btnCancel) btnCancel.onclick = () => { c.innerHTML = ''; };
    const btnSave = document.getElementById('btn-save-book');
    if (btnSave) btnSave.onclick = async () => {
      const titulo = document.getElementById('form-title');
      const autor = document.getElementById('form-author');
      const paginas = document.getElementById('form-paginas');
      if (!titulo || !autor || !paginas) return;
      const t = titulo.value.trim();
      const a = autor.value.trim();
      const p = parseInt(paginas.value, 10) || 0;
      const disp = document.getElementById('form-available')?.checked ?? true;
          if (!t || !a) { showError('Preencha título e autor'); return; }
      try {
        if (book) {
          await updateBook(book.id, { titulo: t, autor: a, paginas: p, disponivel: disp });
          showToast('Livro atualizado!');
        } else {
          await createBook({ titulo: t, autor: a, paginas: p, disponivel: disp });
          showToast('Livro cadastrado com sucesso!');
        }
        await loadData();
        renderContent();
      } catch (e) { showError(e.message); }
    };
  };

  const btnNewBook = document.getElementById('btn-new-book');
  if (btnNewBook) btnNewBook.addEventListener('click', () => openBookForm());

  const searchInput = document.getElementById('admin-search');
  if (searchInput) searchInput.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const tbody = document.getElementById('books-tbody');
    if (!tbody) return;
    const filtered = state.books.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    tbody.innerHTML = filtered.map(renderAdminBookRow).join('');
    const count = document.getElementById('book-count');
    if (count) count.textContent = `(${filtered.length})`;
  });

  const tbody = document.getElementById('books-tbody');
  if (tbody) tbody.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit-book]');
    const deleteBtn = e.target.closest('[data-delete]');

    if (editBtn) {
      const id = parseInt(editBtn.dataset.editBook, 10);
      if (!Number.isNaN(id)) {
        const book = state.books.find(b => b.id === id);
        if (book) openBookForm(book);
      }
      return;
    }

    if (!deleteBtn) return;
    const ok = await showConfirmModal('Excluir este livro e suas reservas?');
    if (!ok) return;
    try {
      const id = parseInt(deleteBtn.dataset.delete, 10);
      if (Number.isNaN(id)) { showError('Erro interno'); return; }
      await deleteBook(id);
      showToast('Livro excluído!');
      await loadData();
      renderContent();
    } catch (err) { showError(err.message); }
  });
}

// ─── Admin Users ──────────────────────────────────────────────────

function renderAdminUserRow(u) {
  return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--blue-100);color:var(--blue-600);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0">${u.nome[0]}</div>
          <span style="font-size:14px;font-weight:500;color:var(--slate-700)">${u.nome}</span>
        </div>
      </td>
      <td style="color:var(--slate-500)">${u.email}</td>
      <td>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-secondary" data-edit-user="${u.id_usuario}">${icon('edit')} Editar</button>
          <button class="btn btn-sm btn-danger" data-delete-user="${u.id_usuario}">${icon('trash')}</button>
        </div>
      </td>
    </tr>
  `;
}

function renderUserForm(user) {
  const isEdit = Boolean(user);
  return `
    <div class="form-card" style="margin-bottom:20px">
      <h3>${isEdit ? 'Editar Usuário' : 'Cadastrar Usuário'}</h3>
      <div class="form-grid">
        <div class="input-group"><label>Nome</label><div class="input-wrapper"><input type="text" id="user-name" placeholder="Nome completo" value="${user?.nome || ''}" /></div></div>
        <div class="input-group"><label>E-mail</label><div class="input-wrapper"><input type="email" id="user-email" placeholder="email@exemplo.com" value="${user?.email || ''}" /></div></div>
        <div class="input-group"><label>${isEdit ? 'Nova senha opcional' : 'Senha'}</label><div class="input-wrapper"><input type="password" id="user-pass" placeholder="Mínimo de 6 caracteres" /></div></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="btn-save-user">${isEdit ? 'Salvar Alterações' : 'Salvar Usuário'}</button>
        <button class="btn btn-ghost" id="btn-cancel-user">Cancelar</button>
      </div>
    </div>
  `;
}

function renderAdminUsers() {
  const activeUserIds = new Set(state.loans.filter(l => computeStatus(l) === 'active' || computeStatus(l) === 'overdue').map(l => l.userId));

  return `
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="stat-card"><div class="stat-icon blue">${icon('users')}</div><div class="stat-value">${state.users.length}</div><div class="stat-label">Total</div></div>
      <div class="stat-card"><div class="stat-icon yellow">${icon('bookCopy')}</div><div class="stat-value">${activeUserIds.size}</div><div class="stat-label">Com reservas</div></div>
      <div class="stat-card"><div class="stat-icon green">${icon('alertCircle')}</div><div class="stat-value">${state.loans.filter(l => computeStatus(l) === 'overdue').length}</div><div class="stat-label">Em atraso</div></div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary" id="btn-new-user">${icon('plus')} Novo Usuário</button>
    </div>
    <div id="user-form-container"></div>
    <div class="card" style="overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--slate-50)">
        <h3 style="font-size:16px;font-weight:600">Usuários Cadastrados</h3>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Usuário</th><th>E-mail</th><th>Ações</th></tr></thead>
          <tbody id="users-tbody">
            ${state.users.map(renderAdminUserRow).join('')}
            ${state.users.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:var(--slate-400);padding:32px">Nenhum usuário encontrado</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindAdminUsers() {
  const openUserForm = (user = null) => {
    const c = document.getElementById('user-form-container');
    if (!c) return;
    c.innerHTML = renderUserForm(user);

    const btnCancel = document.getElementById('btn-cancel-user');
    if (btnCancel) btnCancel.onclick = () => { c.innerHTML = ''; };
    const btnSave = document.getElementById('btn-save-user');
    if (btnSave) btnSave.onclick = async () => {
      const nome = document.getElementById('user-name');
      const email = document.getElementById('user-email');
      const senha = document.getElementById('user-pass');
      if (!nome || !email) return;
      const n = nome.value.trim();
      const e = email.value.trim();
      const s = senha ? senha.value : '';
      if (!n || !e) { showError('Preencha nome e e-mail'); return; }
      if (!user && !s) { showError('Informe uma senha'); return; }
      if (s && s.length < 6) { showError('A senha deve ter pelo menos 6 caracteres'); return; }
      if (!e.includes('@')) { showError('Digite um e-mail válido'); return; }

      try {
        const payload = { nome: n, email: e };
        if (s) payload.senha = s;

        if (user) {
          await updateUser(user.id_usuario, payload);
          showToast('Usuário atualizado!');
        } else {
          await createUser(payload);
          showToast('Usuário cadastrado!');
        }

        await loadData();
        renderContent();
      } catch (err) { showError(err.message); }
    };
  };

  const btnNewUser = document.getElementById('btn-new-user');
  if (btnNewUser) btnNewUser.addEventListener('click', () => openUserForm());

  const tbody = document.getElementById('users-tbody');
  if (tbody) tbody.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit-user]');
    const deleteBtn = e.target.closest('[data-delete-user]');

    if (editBtn) {
      const id = parseInt(editBtn.dataset.editUser, 10);
      if (!Number.isNaN(id)) {
        const user = state.users.find(u => u.id_usuario === id);
        if (user) openUserForm(user);
      }
      return;
    }

    if (!deleteBtn) return;
    const ok = await showConfirmModal('Excluir este usuário e suas reservas?');
    if (!ok) return;
    try {
      const id = parseInt(deleteBtn.dataset.deleteUser, 10);
      if (Number.isNaN(id)) { showError('Erro interno'); return; }
      await deleteUser(id);
      showToast('Usuário excluído!');
      await loadData();
      renderContent();
    } catch (err) { showError(err.message); }
  });
}

function renderEditLoanModal(loan) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-modal-overlay';
  overlay.innerHTML = `
    <div class="confirm-modal" style="max-width:420px;text-align:left">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--slate-800)">Editar Datas da Reserva</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group">
          <label>Data do Empréstimo</label>
          <div class="input-wrapper">
            <input type="date" id="edit-data-emprestimo" value="${loan.dataEmprestimo || ''}" />
          </div>
        </div>
        <div class="input-group">
          <label>Data Prevista</label>
          <div class="input-wrapper">
            <input type="date" id="edit-data-prevista" value="${loan.dataPrevista || ''}" />
          </div>
        </div>
        <div class="input-group">
          <label>Data de Devolução</label>
          <div class="input-wrapper">
            <input type="date" id="edit-data-devolucao" value="${loan.dataDevolucao || ''}" />
          </div>
        </div>
      </div>
      <div class="confirm-actions" style="margin-top:20px">
        <button class="btn btn-primary" id="edit-save-loan">Salvar</button>
        <button class="btn btn-ghost" id="edit-cancel-loan">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    document.getElementById('edit-save-loan').onclick = async () => {
      const payload = {};
      const empVal = document.getElementById('edit-data-emprestimo').value;
      const prevVal = document.getElementById('edit-data-prevista').value;
      const devVal = document.getElementById('edit-data-devolucao').value;
      if (empVal) payload.data_emprestimo = empVal;
      if (prevVal) payload.data_prevista = prevVal;
      if (devVal) payload.data_devolucao = devVal;
      overlay.remove();
      resolve(Object.keys(payload).length > 0 ? payload : null);
    };
    document.getElementById('edit-cancel-loan').onclick = () => { overlay.remove(); resolve(null); };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } };
  });
}

// ─── Admin Loans ──────────────────────────────────────────────────

function renderAdminLoans() {
  const loans = state.loans.map(l => ({ ...l, _computedStatus: computeStatus(l) }));
  const activeLoans = loans.filter(l => l._computedStatus === 'active');
  const overdueLoans = loans.filter(l => l._computedStatus === 'overdue');

  return `
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="stat-card"><div class="stat-icon blue">${icon('bookCopy')}</div><div class="stat-value">${activeLoans.length}</div><div class="stat-label">Ativos</div></div>
      <div class="stat-card"><div class="stat-icon yellow">${icon('alertCircle')}</div><div class="stat-value">${overdueLoans.length}</div><div class="stat-label">Em atraso</div></div>
      <div class="stat-card"><div class="stat-icon green">${icon('trending')}</div><div class="stat-value">${loans.length}</div><div class="stat-label">Total</div></div>
    </div>
    <div class="card" style="overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--slate-50);display:flex;justify-content:space-between;align-items:center">
        <h3 style="font-size:16px;font-weight:600">Todas as Reservas</h3>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Livro</th><th>Usuário</th><th>Empréstimo</th><th>Previsto</th><th>Devolução</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody id="loans-tbody">
            ${loans.map(l => {
              const book = state.books.find(b => b.id === l.bookId) || { title: 'Livro', author: '?' };
            const user = state.users.find(u => u.id_usuario === l.userId) || { nome: 'Usuário' };
              const isOverdue = l._computedStatus === 'overdue';
              const canReturn = l._computedStatus === 'active' || l._computedStatus === 'overdue';
              const canMarkOverdue = l._computedStatus === 'active';
              return `
                <tr>
                  <td><span style="font-size:14px;font-weight:500;color:var(--slate-700)">${book.title}</span> <span style="font-size:12px;color:var(--slate-400);margin-left:6px">${book.author}</span></td>
                  <td style="color:var(--slate-500)">${user.nome}</td>
                  <td style="color:var(--slate-500)">${displayDate(l.dataEmprestimo || l.borrowDate)}</td>
                  <td style="color:${isOverdue ? 'var(--red-600)' : 'var(--slate-500)'};font-weight:${isOverdue ? '500' : 'normal'}">${displayDate(l.dataPrevista)}</td>
                  <td style="color:var(--slate-500)">${displayDate(l.dataDevolucao)}</td>
                  <td>${statusBadge(l._computedStatus)}</td>
                  <td>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                      ${canReturn ? `<button class="btn btn-sm btn-success" data-devolve="${l.id}">${icon('check')} Devolver</button>` : ''}
                      ${canMarkOverdue ? `<button class="btn btn-sm btn-warning" data-overdue="${l.id}">${icon('alertCircle')} Marcar Atrasado</button>` : ''}
                      <button class="btn btn-sm btn-secondary" data-edit-loan="${l.id}">${icon('edit')} Datas</button>
                      ${l._computedStatus === 'active' || l._computedStatus === 'overdue' ? `<button class="btn btn-sm btn-warning" data-cancel-loan="${l.id}">${icon('x')} Cancelar</button>` : ''}
                      <button class="btn btn-sm btn-danger" data-delete-loan="${l.id}">${icon('trash')}</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
            ${loans.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--slate-400);padding:32px">Nenhuma reserva encontrada</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindAdminLoans() {
  const tbody = document.getElementById('loans-tbody');
  if (!tbody) return;
  tbody.addEventListener('click', async e => {
    const returnBtn = e.target.closest('[data-devolve]');
    const cancelBtn = e.target.closest('[data-cancel-loan]');
    const deleteBtn = e.target.closest('[data-delete-loan]');
    const editBtn = e.target.closest('[data-edit-loan]');
    const overdueBtn = e.target.closest('[data-overdue]');

    try {
      if (returnBtn) {
        const id = parseInt(returnBtn.dataset.devolve, 10);
        if (Number.isNaN(id)) { showError('Erro interno'); return; }
        await updateReservation(id, 'DEVOLVIDO');
        showToast('Devolução registrada!');
      } else if (cancelBtn) {
        const okCancel = await showConfirmModal('Cancelar esta reserva?');
        if (!okCancel) return;
        const id = parseInt(cancelBtn.dataset.cancelLoan, 10);
        if (Number.isNaN(id)) { showError('Erro interno'); return; }
        await updateReservation(id, 'CANCELADA');
        showToast('Reserva cancelada!');
      } else if (deleteBtn) {
        const okDelete = await showConfirmModal('Excluir este registro de reserva?');
        if (!okDelete) return;
        const id = parseInt(deleteBtn.dataset.deleteLoan, 10);
        if (Number.isNaN(id)) { showError('Erro interno'); return; }
        await deleteReservation(id);
        showToast('Reserva excluída!');
      } else if (editBtn) {
        const id = parseInt(editBtn.dataset.editLoan, 10);
        if (Number.isNaN(id)) { showError('Erro interno'); return; }
        const loan = state.loans.find(l => l.id === id);
        if (!loan) { showError('Reserva não encontrada'); return; }
        const dates = await renderEditLoanModal(loan);
        if (!dates) return;
        await updateReservationDates(id, dates);
        showToast('Datas atualizadas!');
      } else if (overdueBtn) {
        const okOverdue = await showConfirmModal('Marcar esta reserva como ATRASADA?');
        if (!okOverdue) return;
        const id = parseInt(overdueBtn.dataset.overdue, 10);
        if (Number.isNaN(id)) { showError('Erro interno'); return; }
        await updateReservation(id, 'ATRASADA');
        showToast('Reserva marcada como atrasada!');
      } else {
        return;
      }

      await loadData();
      renderContent();
    } catch (e) {
      showError(e.message);
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────

function init() {
  const initPath = window.location.pathname;
  const initScreen = routes[initPath] || 'login';

  if (savedSession) {
    const targetScreen = state.isAdmin ? 'admin-dashboard' : 'dashboard';
    state.screen = targetScreen;
    history.replaceState({ screen: targetScreen }, '', screenToPath[targetScreen] || '/');
    render();
    loadData();
  } else {
    if (initScreen.startsWith('admin-') || initScreen !== 'login') {
      state.screen = 'login';
      history.replaceState({ screen: 'login' }, '', '/login');
    } else {
      state.screen = initScreen;
      history.replaceState({ screen: initScreen }, '', '/login');
    }
    render();
  }
}

init();