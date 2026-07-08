const CATEGORIES = ['Todos', 'Fantasia', 'Literatura Brasileira', 'Tecnologia', 'Historia', 'Ficcao Cientifica', 'Infanto-Juvenil', 'Autoajuda'];
const COVER_DEFAULT = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=420&fit=crop&auto=format';
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

const state = {
  screen: 'login',
  isAdmin: false,
  user: null,
  books: [],
  loans: [],
  users: [],
  selectedBook: null,
  sidebarOpen: false,
};

function navigate(screen) {
  state.screen = screen;
  state.sidebarOpen = false;
  render();
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    <span>${msg}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function formatDate(value) {
  if (!value) return '-';
  return String(value).split('T')[0];
}

function statusBadge(status) {
  const className = status === 'active'
    ? 'badge-green'
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
    chevron: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  };
  return icons[name] || '';
}

function mapBook(b) {
  return {
    id: b.id_livro,
    title: b.titulo || 'Sem titulo',
    author: b.autor || 'Desconhecido',
    available: Number(b.disponivel) ? 1 : 0,
    total: 1,
    cover: COVER_DEFAULT,
  };
}

function mapReservation(r) {
  const rawStatus = String(r.status || 'ATIVA').toUpperCase();
  return {
    id: r.id_reserva,
    bookId: r.id_livro,
    userId: r.id_usuario,
    borrowDate: formatDate(r.data_reserva),
    status: STATUS_MAP[rawStatus] || 'overdue',
  };
}

async function loadData() {
  try {
    const [books, reservations, users] = await Promise.all([
      fetchBooks().catch(() => []),
      fetchReservations().catch(() => []),
      fetchUsers().catch(() => []),
    ]);
    state.books = books.map(mapBook);
    state.loans = reservations.map(mapReservation);
    state.users = users;
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
  }
}

async function handleLogin(email, senha) {
  try {
    const user = await loginUser(email, senha);
    state.user = { id: user.id_usuario, nome: user.nome, email: user.email };
    state.isAdmin = false;
    await loadData();
    navigate('dashboard');
  } catch (e) {
    alert(e.message);
  }
}

function handleAdminLogin() {
  state.user = { id: 999, nome: 'Admin', email: 'admin@caluralivros.com' };
  state.isAdmin = true;
  loadData().then(() => navigate('admin-dashboard'));
}

function handleLogout() {
  state.user = null;
  state.isAdmin = false;
  state.books = [];
  state.loans = [];
  state.users = [];
  navigate('login');
}

function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  render();
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
          <p>Sistema de Gestao de Biblioteca</p>
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
            <div style="text-align:right">
              <a href="#" style="font-size:14px;color:var(--blue-600);font-weight:500;">Esqueci minha senha</a>
            </div>
            <button class="btn btn-primary btn-lg" id="btn-login" style="width:100%">Entrar</button>
            <div class="login-divider"><hr /><span>ou</span><hr /></div>
            <button class="btn btn-yellow btn-lg" id="btn-admin" style="width:100%">Entrar como Administrador</button>
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
                <input type="password" id="reg-pass" class="has-icon" placeholder="Minimo de 6 caracteres" />
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

  tabLogin.onclick = () => {
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
    loginForm.style.display = '';
    regForm.style.display = 'none';
  };
  tabReg.onclick = () => {
    tabReg.classList.add('active');
    tabLogin.classList.remove('active');
    regForm.style.display = '';
    loginForm.style.display = 'none';
  };

  document.getElementById('toggle-pass').onclick = () => {
    const inp = document.getElementById('login-pass');
    const btn = document.getElementById('toggle-pass');
    if (inp.type === 'password') { inp.type = 'text'; btn.innerHTML = icon('eyeOn'); }
    else { inp.type = 'password'; btn.innerHTML = icon('eyeOff'); }
  };

  document.getElementById('btn-login').onclick = () => {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-pass').value;
    if (!email || !senha) { alert('Digite e-mail e senha'); return; }
    handleLogin(email, senha);
  };

  document.getElementById('btn-admin').onclick = handleAdminLogin;

  document.getElementById('btn-register').onclick = async () => {
    const nome = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const senha = document.getElementById('reg-pass').value;
    if (!nome || !email || !senha) { alert('Preencha todos os campos'); return; }
    if (senha.length < 6) { alert('A senha deve ter pelo menos 6 caracteres'); return; }
    try {
      const user = await createUser({ nome, email, senha });
      state.user = { id: user.id_usuario || user.id, nome: user.nome, email: user.email };
      state.isAdmin = false;
      await loadData();
      navigate('dashboard');
    } catch (e) {
      alert(e.message);
    }
  };
}

// ─── Layout ───────────────────────────────────────────────────────

function renderLayout() {
  const s = state.screen;
  const titles = {
    dashboard: 'Catalogo',
    'book-detail': 'Detalhes do Livro',
    'my-loans': 'Meus Emprestimos',
    profile: 'Perfil',
    'admin-dashboard': 'Dashboard',
    'admin-books': 'Gestao de Livros',
    'admin-users': 'Usuarios',
    'admin-loans': 'Emprestimos',
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
              <span class="dot"></span>
            </button>
            <div class="topbar-user">
              <div class="topbar-avatar">${state.user?.nome?.[0] || 'A'}</div>
              <div class="topbar-user-info">
                <div class="name">${state.user?.nome || 'Usuario'}</div>
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
    { icon: 'home', label: 'Inicio', screen: 'dashboard' },
    { icon: 'clipboard', label: 'Meus Emprestimos', screen: 'my-loans' },
    { icon: 'user', label: 'Perfil', screen: 'profile' },
  ];
  const adminNav = [
    { icon: 'dashboard', label: 'Dashboard', screen: 'admin-dashboard' },
    { icon: 'book', label: 'Livros', screen: 'admin-books' },
    { icon: 'users', label: 'Usuarios', screen: 'admin-users' },
    { icon: 'clipboard', label: 'Emprestimos', screen: 'admin-loans' },
  ];
  const nav = state.isAdmin ? adminNav : userNav;

  return `
    <aside class="sidebar ${state.sidebarOpen ? 'open' : ''}">
      <div class="sidebar-logo">
        <div class="logo-icon">${icon('book')}</div>
        <span class="logo-text">Calura<span>Livros</span></span>
      </div>
      <nav class="sidebar-nav">
        ${state.isAdmin ? '<p class="nav-label">Administracao</p>' : ''}
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
  document.getElementById('menu-btn')?.addEventListener('click', toggleSidebar);
  document.getElementById('overlay')?.addEventListener('click', () => { state.sidebarOpen = false; render(); });
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);

  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });

  renderContent();
}

// ─── Content Router ───────────────────────────────────────────────

function renderContent() {
  const c = document.getElementById('content');
  if (!c) return;
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
    myActive: state.user ? state.loans.filter(l => l.userId === state.user.id && l.status === 'active').length : 0,
  };
  const filtered = books;

  return `
    <div class="dash-hero">
      <h2>Ola, ${state.user?.nome?.split(' ')[0] || 'Visitante'}!</h2>
      <p>O que voce quer ler hoje?</p>
      <div class="search-box">
        ${icon('search')}
        <input type="text" id="search-input" placeholder="Buscar por titulo ou autor..." />
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
        <div class="stat-label">Disponiveis</div>
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
        <h2 id="catalog-title">Catalogo <span>(${filtered.length} livros)</span></h2>
      </div>
      <div class="books-grid" id="books-grid">
        ${filtered.length === 0
          ? `<div class="empty-state" style="grid-column:1/-1">${icon('book')}<p>Nenhum livro encontrado</p></div>`
          : filtered.map(renderBookCard).join('')
        }
      </div>
    </section>
  `;
}

function renderBookCard(book) {
  const avail = book.available > 0;
  return `
    <div class="book-card" data-book-id="${book.id}">
      <div class="book-cover">
        <img src="${book.cover}" alt="${book.title}" loading="lazy" />
        <span class="cover-badge badge ${avail ? 'badge-green' : 'badge-red'}">${avail ? 'Disponivel' : 'Emprestado'}</span>
        <span class="cover-rating">${icon('star')} ${book.id * 4.5 % 5 === 0 ? '4.5' : (4 + (book.id % 10) / 10).toFixed(1)}</span>
      </div>
      <div class="book-info">
        <div class="book-category">${CATEGORIES[book.id % CATEGORIES.length] || 'Geral'}</div>
        <div class="book-title">${book.title}</div>
        <div class="book-author">${book.author}</div>
        <div class="book-footer">
          <span class="avail">${book.available}/${book.total} disp.</span>
          <button class="btn btn-sm ${avail ? 'btn-primary' : 'btn-ghost'}" data-borrow="${book.id}" ${!avail ? 'disabled' : ''}>${avail ? 'Emprestar' : 'Indisponivel'}</button>
        </div>
      </div>
    </div>
  `;
}

function bindDashboard() {
  let searchQuery = '';
  let activeCategory = 'Todos';

  const filterBooks = () => {
    let list = state.books;
    if (activeCategory !== 'Todos') list = list.filter(b => b.title.toLowerCase().includes(activeCategory.toLowerCase()) || b.author.toLowerCase().includes(activeCategory.toLowerCase()));
    if (searchQuery) list = list.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.author.toLowerCase().includes(searchQuery.toLowerCase()));

    const grid = document.getElementById('books-grid');
    const title = document.getElementById('catalog-title');
    if (title) title.innerHTML = searchQuery ? `Resultados para "${searchQuery}" <span>(${list.length} livros)</span>` : `Catalogo <span>(${list.length} livros)</span>`;
    if (grid) grid.innerHTML = list.length === 0
      ? `<div class="empty-state" style="grid-column:1/-1">${icon('book')}<p>Nenhum livro encontrado</p></div>`
      : list.map(renderBookCard).join('');
    bindBookCards();
  };

  document.getElementById('search-input')?.addEventListener('input', e => {
    searchQuery = e.target.value;
    filterBooks();
  });

  document.querySelectorAll('#cat-bar button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      document.querySelectorAll('#cat-bar button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterBooks();
    });
  });

  function bindBookCards() {
    document.querySelectorAll('.book-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-borrow]')) {
          e.stopPropagation();
          handleBorrow(parseInt(e.target.closest('[data-borrow]').dataset.borrow));
          return;
        }
        const id = parseInt(card.dataset.bookId);
        const book = state.books.find(b => b.id === id);
        if (book) { state.selectedBook = book; navigate('book-detail'); }
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
    showToast('Emprestimo solicitado com sucesso!');
    await loadData();
    state.selectedBook = state.books.find(b => b.id === bookId) || state.selectedBook;
    if (state.screen === 'dashboard' || state.screen === 'book-detail') renderContent();
  } catch (e) {
    alert(e.message);
  }
}

// ─── Book Detail ──────────────────────────────────────────────────

function renderBookDetail() {
  const book = state.selectedBook;
  if (!book) return '<p>Livro nao encontrado</p>';
  const avail = book.available > 0;
  return `
    <button class="detail-back" id="btn-back">${icon('arrowLeft')} Voltar ao catalogo</button>
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
          <div class="meta-item"><div class="label">Disponiveis</div><div class="value">${book.available} de ${book.total}</div></div>
        </div>
        <div class="detail-synopsis">
          <h3>Sinopse</h3>
          <p>${book.title} esta cadastrado no acervo da biblioteca com autoria de ${book.author}. Use a disponibilidade abaixo para solicitar o emprestimo quando houver exemplar livre.</p>
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
            ? `<button class="btn btn-primary btn-lg" id="btn-detail-borrow">${icon('book')} Solicitar Emprestimo</button>`
            : `<button class="btn btn-secondary btn-lg" disabled>${icon('clock')} Indisponivel no momento</button>`
          }
          <button class="btn btn-ghost btn-lg" id="btn-detail-back">${icon('arrowLeft')} Voltar</button>
        </div>
      </div>
    </div>
  `;
}

function bindBookDetail() {
  document.getElementById('btn-back')?.addEventListener('click', () => navigate('dashboard'));
  document.getElementById('btn-detail-back')?.addEventListener('click', () => navigate('dashboard'));
  document.getElementById('btn-detail-borrow')?.addEventListener('click', () => {
    if (state.selectedBook) handleBorrow(state.selectedBook.id);
  });
}

// ─── My Loans ─────────────────────────────────────────────────────

function renderMyLoans() {
  const myLoans = state.user ? state.loans.filter(l => l.userId === state.user.id) : [];
  const active = myLoans.filter(l => l.status === 'active' || l.status === 'overdue');
  const history = myLoans.filter(l => l.status === 'returned' || l.status === 'cancelled');

  function findBook(bookId) {
    return state.books.find(b => b.id === bookId) || { title: 'Livro', author: 'Desconhecido', cover: COVER_DEFAULT };
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
        <div class="stat-value">0</div>
        <div class="stat-label">Atrasados</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">${icon('check')}</div>
        <div class="stat-value">${history.length}</div>
        <div class="stat-label">Devolvidos</div>
      </div>
    </div>
    <section style="margin-bottom:32px">
      <div class="section-header"><h2>Emprestimos Ativos</h2></div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${active.length === 0 ? '<p style="text-align:center;color:var(--slate-400);padding:24px">Nenhum emprestimo ativo</p>' :
          active.map(l => {
            const book = findBook(l.bookId);
            return `
              <div class="loan-card">
                <div class="loan-cover"><img src="${book.cover}" alt="${book.title}" /></div>
                <div class="loan-info">
                  ${statusBadge(l.status)}
                  <h3 style="font-size:14px;font-weight:600;color:var(--slate-800);margin-top:4px">${book.title}</h3>
                  <p style="font-size:12px;color:var(--slate-500)">${book.author}</p>
                  <div class="loan-dates">
                    <span>Retirada: ${l.borrowDate}</span>
                  </div>
                </div>
                <button class="btn btn-sm btn-danger" data-cancel-reservation="${l.id}">${icon('x')} Cancelar</button>
              </div>
            `;
          }).join('')
        }
      </div>
    </section>
    <section>
      <div class="section-header"><h2>Historico</h2></div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${history.length === 0 ? '<p style="text-align:center;color:var(--slate-400);padding:24px">Nenhum historico</p>' :
          history.map(l => {
            const book = findBook(l.bookId);
            return `
              <div class="loan-card" style="opacity:0.6">
                <div class="loan-cover"><img src="${book.cover}" alt="${book.title}" style="filter:grayscale(1)" /></div>
                <div class="loan-info">
                  ${statusBadge(l.status)}
                  <h3 style="font-size:14px;font-weight:600;color:var(--slate-700);margin-top:4px">${book.title}</h3>
                  <p style="font-size:12px;color:var(--slate-400)">${l.borrowDate}</p>
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
  document.querySelectorAll('[data-cancel-reservation]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Cancelar esta reserva?')) return;
      try {
        await updateReservation(parseInt(btn.dataset.cancelReservation), 'CANCELADA');
        showToast('Reserva cancelada!');
        await loadData();
        renderContent();
      } catch (e) {
        alert(e.message);
      }
    });
  });
}

// ─── Profile ──────────────────────────────────────────────────────

function renderProfile() {
  const u = state.user;
  return `
    <div style="max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:20px">
      <div class="profile-hero">
        <div class="profile-avatar">${u?.nome?.[0] || 'A'}</div>
        <div>
          <h2>${u?.nome || 'Usuario'}</h2>
          <p class="course">Estudante</p>
          <p class="email">${u?.email || ''}</p>
        </div>
      </div>
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card">
          <div class="stat-icon blue">${icon('bookCopy')}</div>
          <div class="stat-value">${state.loans.filter(l => l.userId === u?.id && l.status === 'active').length}</div>
          <div class="stat-label">Emprestados</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">${icon('clipboard')}</div>
          <div class="stat-value">${state.loans.filter(l => l.userId === u?.id).length}</div>
          <div class="stat-label">Historico</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon yellow">${icon('alertCircle')}</div>
          <div class="stat-value">0</div>
          <div class="stat-label">Atrasados</div>
        </div>
      </div>
      <div class="card profile-info">
        <h3>Informacoes Pessoais</h3>
        <div class="profile-field"><span class="label">Nome</span><span class="value">${u?.nome || '-'}</span></div>
        <div class="profile-field"><span class="label">E-mail</span><span class="value">${u?.email || '-'}</span></div>
        <div class="profile-field"><span class="label">ID</span><span class="value">${u?.id || '-'}</span></div>
      </div>
      <button class="btn btn-danger btn-lg" id="btn-profile-logout" style="width:100%">${icon('logout')} Sair da conta</button>
    </div>
  `;
}

function bindProfile() {
  document.getElementById('btn-profile-logout')?.addEventListener('click', handleLogout);
}

// ─── Admin Dashboard ──────────────────────────────────────────────

function renderAdminDashboard() {
  const books = state.books;
  const loans = state.loans;
  return `
    <div class="admin-hero">
      <h2>Painel Administrativo</h2>
      <p>Gestao completa do acervo e usuarios</p>
      <div class="hero-actions">
        <button class="btn btn-yellow btn-sm" data-nav="admin-books">${icon('plus')} Novo Livro</button>
        <button class="btn btn-ghost btn-sm" style="color:rgba(255,255,255,0.7)" data-nav="admin-users">${icon('users')} Usuarios</button>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon blue">${icon('book')}</div><div class="stat-value">${books.length}</div><div class="stat-label">Total de Livros</div></div>
      <div class="stat-card"><div class="stat-icon yellow">${icon('bookCopy')}</div><div class="stat-value">${books.filter(b => b.available === 0).length}</div><div class="stat-label">Livros Emprestados</div></div>
      <div class="stat-card"><div class="stat-icon green">${icon('users')}</div><div class="stat-value">${state.users.length}</div><div class="stat-label">Usuarios Cadastrados</div></div>
      <div class="stat-card"><div class="stat-icon purple">${icon('trending')}</div><div class="stat-value">${loans.filter(l => l.status === 'active').length}</div><div class="stat-label">Emprestimos Ativos</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card recent-loans-card" style="padding:20px">
        <div class="card-header">
          <h3>Emprestimos Recentes</h3>
          <a href="#" data-nav="admin-loans" style="cursor:pointer">Ver todos</a>
        </div>
        <div>
          ${loans.slice(0, 4).map(l => {
            const book = state.books.find(b => b.id === l.bookId) || { title: 'Livro', author: '?' };
            const user = state.users.find(u => u.id_usuario === l.userId) || { nome: 'Usuario' };
            return `
              <div class="recent-item">
                <div class="recent-avatar">${user.nome[0]}</div>
                <div class="recent-info">
                  <div class="name">${user.nome}</div>
                  <div class="detail">${book.title} - ${l.borrowDate}</div>
                </div>
                <span class="badge ${l.status === 'active' ? 'badge-green' : 'badge-red'}">${l.status === 'active' ? 'Ativo' : 'Atrasado'}</span>
              </div>
            `;
          }).join('') || '<p style="text-align:center;color:var(--slate-400);padding:16px">Nenhum emprestimo</p>'}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="card" style="padding:20px">
          <h3 style="font-size:16px;font-weight:600;margin-bottom:12px">Acoes Rapidas</h3>
          <div class="quick-actions">
            <button class="btn btn-primary btn-sm" data-nav="admin-books" style="justify-content:flex-start">${icon('plus')} Cadastrar Livro</button>
            <button class="btn btn-secondary btn-sm" data-nav="admin-users" style="justify-content:flex-start">${icon('users')} Ver Usuarios</button>
            <button class="btn btn-secondary btn-sm" data-nav="admin-loans" style="justify-content:flex-start">${icon('clipboard')} Emprestimos</button>
            <button class="btn btn-secondary btn-sm" data-nav="admin-dashboard" style="justify-content:flex-start">${icon('trending')} Relatorios</button>
          </div>
        </div>
        <div class="alert-card">
          <div class="alert-icon">${icon('alertCircle')}</div>
          <div>
            <div class="alert-title">${loans.filter(l => l.status === 'overdue').length || 0} emprestimos em atraso</div>
            <div class="alert-desc">Usuarios precisam ser notificados sobre devolucao.</div>
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
      <td>${b.available}/${b.total}</td>
      <td><span class="badge ${b.available > 0 ? 'badge-green' : 'badge-red'}">${b.available > 0 ? 'Disponivel' : 'Esgotado'}</span></td>
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
        <div class="input-group"><label>Titulo</label><div class="input-wrapper"><input type="text" id="form-title" placeholder="Titulo do livro" value="${book?.title || ''}" /></div></div>
        <div class="input-group"><label>Autor</label><div class="input-wrapper"><input type="text" id="form-author" placeholder="Nome do autor" value="${book?.author || ''}" /></div></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:14px;color:var(--slate-600)">
        <input type="checkbox" id="form-available" ${!book || book.available > 0 ? 'checked' : ''} />
        Livro disponivel
      </label>
      <div class="form-actions">
        <button class="btn btn-primary" id="btn-save-book">${isEdit ? 'Salvar Alteracoes' : 'Salvar Livro'}</button>
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
              <th>Disponiveis</th>
              <th>Status</th>
              <th>Acoes</th>
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
    c.innerHTML = renderBookForm(book);

    document.getElementById('btn-cancel-book').onclick = () => { c.innerHTML = ''; };
    document.getElementById('btn-save-book').onclick = async () => {
      const titulo = document.getElementById('form-title').value.trim();
      const autor = document.getElementById('form-author').value.trim();
      const disponivel = document.getElementById('form-available').checked;
      if (!titulo || !autor) { alert('Preencha titulo e autor'); return; }
      try {
        if (book) {
          await updateBook(book.id, { titulo, autor, disponivel });
          showToast('Livro atualizado!');
        } else {
          await createBook({ titulo, autor, disponivel });
          showToast('Livro cadastrado com sucesso!');
        }
        await loadData();
        renderContent();
      } catch (e) { alert(e.message); }
    };
  };

  document.getElementById('btn-new-book')?.addEventListener('click', () => openBookForm());

  document.getElementById('admin-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const tbody = document.getElementById('books-tbody');
    const filtered = state.books.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    tbody.innerHTML = filtered.map(renderAdminBookRow).join('');
    document.getElementById('book-count').textContent = `(${filtered.length})`;
  });

  document.getElementById('books-tbody')?.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit-book]');
    const deleteBtn = e.target.closest('[data-delete]');

    if (editBtn) {
      const book = state.books.find(b => b.id === parseInt(editBtn.dataset.editBook));
      if (book) openBookForm(book);
      return;
    }

    if (!deleteBtn) return;
    if (!confirm('Excluir este livro e suas reservas?')) return;
    try {
      await deleteBook(parseInt(deleteBtn.dataset.delete));
      showToast('Livro excluido!');
      await loadData();
      renderContent();
    } catch (err) { alert(err.message); }
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
      <h3>${isEdit ? 'Editar Usuario' : 'Cadastrar Usuario'}</h3>
      <div class="form-grid">
        <div class="input-group"><label>Nome</label><div class="input-wrapper"><input type="text" id="user-name" placeholder="Nome completo" value="${user?.nome || ''}" /></div></div>
        <div class="input-group"><label>E-mail</label><div class="input-wrapper"><input type="email" id="user-email" placeholder="email@exemplo.com" value="${user?.email || ''}" /></div></div>
        <div class="input-group"><label>${isEdit ? 'Nova senha opcional' : 'Senha'}</label><div class="input-wrapper"><input type="password" id="user-pass" placeholder="Minimo de 6 caracteres" /></div></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="btn-save-user">${isEdit ? 'Salvar Alteracoes' : 'Salvar Usuario'}</button>
        <button class="btn btn-ghost" id="btn-cancel-user">Cancelar</button>
      </div>
    </div>
  `;
}

function renderAdminUsers() {
  const activeUserIds = new Set(state.loans.filter(l => l.status === 'active' || l.status === 'overdue').map(l => l.userId));

  return `
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="stat-card"><div class="stat-icon blue">${icon('users')}</div><div class="stat-value">${state.users.length}</div><div class="stat-label">Total</div></div>
      <div class="stat-card"><div class="stat-icon yellow">${icon('bookCopy')}</div><div class="stat-value">${activeUserIds.size}</div><div class="stat-label">Com emprestimos</div></div>
      <div class="stat-card"><div class="stat-icon green">${icon('alertCircle')}</div><div class="stat-value">${state.loans.filter(l => l.status === 'overdue').length}</div><div class="stat-label">Em atraso</div></div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary" id="btn-new-user">${icon('plus')} Novo Usuario</button>
    </div>
    <div id="user-form-container"></div>
    <div class="card" style="overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--slate-50)">
        <h3 style="font-size:16px;font-weight:600">Usuarios Cadastrados</h3>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Usuario</th><th>E-mail</th><th>Acoes</th></tr></thead>
          <tbody id="users-tbody">
            ${state.users.map(renderAdminUserRow).join('')}
            ${state.users.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:var(--slate-400);padding:32px">Nenhum usuario encontrado</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindAdminUsers() {
  const openUserForm = (user = null) => {
    const c = document.getElementById('user-form-container');
    c.innerHTML = renderUserForm(user);

    document.getElementById('btn-cancel-user').onclick = () => { c.innerHTML = ''; };
    document.getElementById('btn-save-user').onclick = async () => {
      const nome = document.getElementById('user-name').value.trim();
      const email = document.getElementById('user-email').value.trim();
      const senha = document.getElementById('user-pass').value;

      if (!nome || !email) { alert('Preencha nome e e-mail'); return; }
      if (!user && !senha) { alert('Informe uma senha'); return; }
      if (senha && senha.length < 6) { alert('A senha deve ter pelo menos 6 caracteres'); return; }

      try {
        const payload = { nome, email };
        if (senha) payload.senha = senha;

        if (user) {
          await updateUser(user.id_usuario, payload);
          showToast('Usuario atualizado!');
        } else {
          await createUser(payload);
          showToast('Usuario cadastrado!');
        }

        await loadData();
        renderContent();
      } catch (e) { alert(e.message); }
    };
  };

  document.getElementById('btn-new-user')?.addEventListener('click', () => openUserForm());

  document.getElementById('users-tbody')?.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit-user]');
    const deleteBtn = e.target.closest('[data-delete-user]');

    if (editBtn) {
      const user = state.users.find(u => u.id_usuario === parseInt(editBtn.dataset.editUser));
      if (user) openUserForm(user);
      return;
    }

    if (!deleteBtn) return;
    if (!confirm('Excluir este usuario e suas reservas?')) return;
    try {
      await deleteUser(parseInt(deleteBtn.dataset.deleteUser));
      showToast('Usuario excluido!');
      await loadData();
      renderContent();
    } catch (err) { alert(err.message); }
  });
}

// ─── Admin Loans ──────────────────────────────────────────────────

function renderAdminLoans() {
  const loans = state.loans;
  return `
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="stat-card"><div class="stat-icon blue">${icon('bookCopy')}</div><div class="stat-value">${loans.filter(l => l.status === 'active').length}</div><div class="stat-label">Ativos</div></div>
      <div class="stat-card"><div class="stat-icon yellow">${icon('alertCircle')}</div><div class="stat-value">${loans.filter(l => l.status === 'overdue').length}</div><div class="stat-label">Em atraso</div></div>
      <div class="stat-card"><div class="stat-icon green">${icon('trending')}</div><div class="stat-value">${loans.length}</div><div class="stat-label">Total</div></div>
    </div>
    <div class="card" style="overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--slate-50);display:flex;justify-content:space-between;align-items:center">
        <h3 style="font-size:16px;font-weight:600">Todos os Emprestimos</h3>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Livro</th><th>Usuario</th><th>Data</th><th>Status</th><th>Acoes</th></tr></thead>
          <tbody id="loans-tbody">
            ${loans.map(l => {
              const book = state.books.find(b => b.id === l.bookId) || { title: 'Livro', author: '?' };
              const user = state.users.find(u => u.id_usuario === l.userId) || { nome: 'Usuario' };
              return `
                <tr>
                  <td><span style="font-size:14px;font-weight:500;color:var(--slate-700)">${book.title}</span> <span style="font-size:12px;color:var(--slate-400);margin-left:6px">${book.author}</span></td>
                  <td style="color:var(--slate-500)">${user.nome}</td>
                  <td style="color:var(--slate-500)">${l.borrowDate}</td>
                  <td>${statusBadge(l.status)}</td>
                  <td>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                      ${l.status === 'active' ? `<button class="btn btn-sm btn-secondary" data-delay-loan="${l.id}">${icon('clock')} Atrasar</button>` : ''}
                      ${l.status === 'active' || l.status === 'overdue' ? `<button class="btn btn-sm btn-secondary" data-devolve="${l.id}">${icon('check')} Devolver</button>` : ''}
                      ${l.status === 'active' || l.status === 'overdue' ? `<button class="btn btn-sm btn-danger" data-cancel-loan="${l.id}">${icon('x')} Cancelar</button>` : ''}
                      <button class="btn btn-sm btn-danger" data-delete-loan="${l.id}">${icon('trash')}</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
            ${loans.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--slate-400);padding:32px">Nenhum emprestimo encontrado</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindAdminLoans() {
  document.getElementById('loans-tbody')?.addEventListener('click', async e => {
    const delayBtn = e.target.closest('[data-delay-loan]');
    const returnBtn = e.target.closest('[data-devolve]');
    const cancelBtn = e.target.closest('[data-cancel-loan]');
    const deleteBtn = e.target.closest('[data-delete-loan]');

    try {
      if (delayBtn) {
        await updateReservation(parseInt(delayBtn.dataset.delayLoan), 'ATRASADA');
        showToast('Emprestimo marcado como atrasado!');
      } else if (returnBtn) {
        await updateReservation(parseInt(returnBtn.dataset.devolve), 'DEVOLVIDO');
        showToast('Devolucao registrada!');
      } else if (cancelBtn) {
        if (!confirm('Cancelar esta reserva?')) return;
        await updateReservation(parseInt(cancelBtn.dataset.cancelLoan), 'CANCELADA');
        showToast('Reserva cancelada!');
      } else if (deleteBtn) {
        if (!confirm('Excluir este registro de reserva?')) return;
        await deleteReservation(parseInt(deleteBtn.dataset.deleteLoan));
        showToast('Reserva excluida!');
      } else {
        return;
      }

      await loadData();
      renderContent();
    } catch (e) {
      alert(e.message);
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────

render();
