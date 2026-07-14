// ================================================================
//  Calura Livros - Frontend SPA
//  Sistema de gerenciamento de biblioteca
//  Funcionalidades: login, catálogo, reservas, admin (livros/reservas)
// ================================================================

// --- Constantes ---

// Capa padrão para livros sem imagem cadastrada
var COVER_DEFAULT = 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=420&fit=crop&auto=format';

// Rótulos usados nas badges de status das reservas
var STATUS_LABELS = {
  ATIVA: 'Ativo',
  ATRASADA: 'Atrasado',
  DEVOLVIDO: 'Devolvido',
  CANCELADA: 'Cancelado',
};

// Chave usada no localStorage para persistir a sessão do usuário
var SESSION_KEY = 'calura_session';

// ================================================================
//  GERENCIAMENTO DE SESSÃO (localStorage)
//  Salva/restaura login, token JWT e tipo de usuário
// ================================================================

function saveSession() {
  var data = {
    user: state.user,
    isAdmin: state.isAdmin,
    token: state.token,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function restoreSession() {
  var raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    var session = JSON.parse(raw);
    if (session.token) setAuthToken(session.token);
    return session;
  } catch (erro) {
    clearSession();
    return null;
  }
}

// Tenta recuperar sessão salva ao carregar a página
var savedSession = restoreSession();

// ================================================================
//  ESTADO GLOBAL
//  Todas as telas leem/escrevem neste objeto.
//  Ele é a "memória" do frontend.
// ================================================================

var state = {
  screen: savedSession ? 'dashboard' : 'login', // tela atual
  isAdmin: savedSession ? savedSession.isAdmin : false,
  user: savedSession ? savedSession.user : null,      // dados do usuário logado
  token: savedSession ? savedSession.token : null,    // token JWT
  books: [],     // livros do catálogo (já convertidos por mapBook)
  loans: [],     // reservas (já convertidas por mapReservation)
  users: [],     // todos os usuários (admin usa)
  sidebarOpen: false,  // menu lateral aberto no mobile
  loading: false,      // tela de carregamento ativa
  _apiOffline: false,  // API fora do ar
};

// ================================================================
//  ROTEAMENTO
//  Mapeia URL do navegador → nome da tela (screen)
// ================================================================

var routes = {
  '/login': 'login',
  '/catalogo': 'dashboard',
  '/minhas-reservas': 'my-loans',
  '/admin': 'admin-books',
  '/admin/livros': 'admin-books',
  '/admin/reservas': 'admin-loans',
};

// Mapa inverso: nome da tela → URL (para o history.pushState)
var screenToPath = {
  login: '/login',
  dashboard: '/catalogo',
  'my-loans': '/minhas-reservas',
  'admin-books': '/admin/livros',
  'admin-loans': '/admin/reservas',
};

// Navega para uma tela (atualiza URL e renderiza)
function navigate(screen) {
  // Bloqueia acesso a telas de admin se usuário não for admin
  if (screen.indexOf('admin-') === 0 && !state.isAdmin) {
    state.screen = 'login';
    history.replaceState({ screen: 'login' }, '', '/login');
    render();
    return;
  }

  state.screen = screen;
  state.sidebarOpen = false;           // fecha menu mobile ao navegar
  var path = screenToPath[screen] || '/';
  history.pushState({ screen: screen }, '', path);
  render();
}

// Detecta quando usuário clica "voltar/avançar" no navegador
window.addEventListener('popstate', function () {
  var path = window.location.pathname;
  var screen = routes[path];
  if (!screen || (screen.indexOf('admin-') === 0 && !state.isAdmin)) {
    state.screen = 'login';
    render();
    return;
  }
  state.screen = screen;
  render();
});

// ================================================================
//  COMPONENTES DE UI
//  Toast (mensagem temporária) e Modal de confirmação
// ================================================================

// Exibe mensagem no canto inferior direito, some após 3 segundos
function showToast(msg, isError) {
  var existente = document.querySelector('.toast');
  if (existente) existente.remove();

  var toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' toast-error' : '');
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 3000);
}

// Modal de confirmação com botões "Sim" / "Cancelar"
// Retorna uma Promise que resolve com true (sim) ou false (não)
// Exemplo de uso:  var ok = await showConfirmModal('Tem certeza?');
function showConfirmModal(msg, isDanger) {
  return new Promise(function (resolve) {
    // Remove modal anterior se existir
    var existente = document.querySelector('.confirm-modal-overlay');
    if (existente) existente.remove();

    var overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    overlay.innerHTML =
      '<div class="confirm-modal ' + (isDanger ? 'modal-danger' : '') + '">' +
        '<h3>' + (isDanger ? 'Confirmação' : 'Tem certeza?') + '</h3>' +
        '<p>' + msg + '</p>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-ghost" id="confirm-no">Cancelar</button>' +
          '<button class="btn ' + (isDanger ? 'btn-danger' : 'btn-primary') + '" id="confirm-yes">' +
            (isDanger ? 'Sim, excluir' : 'Sim') +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('confirm-yes').onclick = function () { overlay.remove(); resolve(true); };
    document.getElementById('confirm-no').onclick = function () { overlay.remove(); resolve(false); };
    // Fecha se clicar fora do modal
    overlay.onclick = function (ev) { if (ev.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

// ================================================================
//  UTILITÁRIOS
// ================================================================

// Extrai só a data (AAAA-MM-DD) de um valor datetime
function formatDate(valor) {
  return valor ? String(valor).split('T')[0] : '';
}

// Converte AAAA-MM-DD → DD/MM/AAAA para exibição
function displayDate(valor) {
  if (!valor) return '-';
  var partes = String(valor).split('T')[0].split('-');
  if (partes.length !== 3) return valor;
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

// Retorna o HTML de uma badge colorida baseada no status da reserva
function statusBadge(status) {
  var mapaClasses = {
    ATIVA: 'badge-green',
    ATRASADA: 'badge-red',
    CANCELADA: 'badge-yellow',
    DEVOLVIDO: 'badge-slate',
  };
  var classe = mapaClasses[status] || 'badge-slate';
  var label = STATUS_LABELS[status] || status;
  return '<span class="badge ' + classe + '">' + label + '</span>';
}

// Ícones SVG inline (usados em botões, sidebar, cards)
// Cada chave é um nome amigável
function icon(nome) {
  var icones = {
    book: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    clipboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
    user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    arrowLeft: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    arrowRight: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    eyeOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    eyeOn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    alertCircle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  return icones[nome] || '';
}

// ================================================================
//  CONVERSÃO DE DADOS (API → formato do frontend)
//  A API retorna nomes em snake_case (id_livro, data_prevista...)
//  Essas funções convertem para camelCase e aplicam fallbacks.
// ================================================================

function mapBook(dados) {
  return {
    id: dados.id_livro,
    title: dados.titulo || 'Sem título',
    author: dados.autor || 'Desconhecido',
    paginas: Number(dados.paginas) || 0,
    available: Number(dados.disponivel) ? 1 : 0,
    total: 1,
    cover: dados.imagem || COVER_DEFAULT,
  };
}

function mapReservation(dados) {
  var status = String(dados.status || 'ATIVA').toUpperCase();
  return {
    id: dados.id_reserva,
    bookId: dados.id_livro,
    userId: dados.id_usuario,
    bookTitle: dados.livro_titulo || 'Livro',
    dataEmprestimo: formatDate(dados.data_emprestimo),
    dataPrevista: formatDate(dados.data_prevista),
    dataDevolucao: formatDate(dados.data_devolucao),
    status: status,
  };
}

// ================================================================
//  CARREGAMENTO DE DADOS DA API
//  Busca livros, reservas e usuários em paralelo.
//  Se ALGUMA chamada falhar, tenta as outras mesmo assim (.catch).
//  Só mostra "API offline" se TODAS as 3 falharem.
// ================================================================

async function loadData() {
  state.loading = true;
  renderContent(); // mostra "Carregando..."

  var algumaFalhou = false;

  try {
    // Promise.all executa as 3 chamadas ao mesmo tempo (paralelo)
    // .catch em cada uma permite que as outras continuem se uma falhar
    var resultados = await Promise.all([
      fetchBooks().catch(function () { algumaFalhou = true; return []; }),
      fetchReservations().catch(function () { algumaFalhou = true; return []; }),
      fetchUsers().catch(function () { algumaFalhou = true; return []; }),
    ]);

    var books = resultados[0];
    var reservations = resultados[1];
    var users = resultados[2];

    state.books = books.map(mapBook);
    state.loans = reservations.map(mapReservation);
    state.users = users;

    // Só considera offline se falhou E não temos nenhum livro em cache
    state._apiOffline = algumaFalhou && state.books.length === 0;
  } catch (erro) {
    state._apiOffline = true;
  } finally {
    state.loading = false;
    renderContent(); // re-renderiza com os dados carregados
  }
}

// ================================================================
//  AUTENTICAÇÃO
// ================================================================

async function handleLogin(email, senha) {
  try {
    var usuario = await loginUser(email, senha);

    // Salva dados do usuário no estado global
    state.user = {
      id: usuario.id_usuario,
      nome: usuario.nome,
      email: usuario.email,
    };
    state.isAdmin = Boolean(usuario.is_admin);
    state.token = usuario.token;

    // Configura o token para as próximas requisições
    setAuthToken(usuario.token);
    saveSession();

    // Carrega os dados e redireciona para a tela certa
    await loadData();
    navigate(state.isAdmin ? 'admin-books' : 'dashboard');
  } catch (erro) {
    showToast(erro.message, true);
  }
}

function handleLogout() {
  // Limpa todo o estado
  state.user = null;
  state.isAdmin = false;
  state.token = null;
  state.books = [];
  state.loans = [];
  state.users = [];

  clearAuthToken();
  clearSession();
  navigate('login');
}

// ================================================================
//  RENDERIZAÇÃO PRINCIPAL
//  Decide qual tela mostrar baseado no state.screen
// ================================================================

function render() {
  var app = document.getElementById('app');

  if (state.screen === 'login') {
    // Tela de login: não tem sidebar/topbar
    app.innerHTML = renderLogin();
    bindLogin();
  } else {
    // Telas internas: layout completo (sidebar + topbar + conteúdo)
    app.innerHTML = renderLayout();
    bindLayout();
  }
}

// ================================================================
//  TELA: LOGIN / REGISTRO
// ================================================================

function renderLogin() {
  return (
    '<div class="login-page">' +
      '<div class="login-card">' +
        '<div class="login-logo">' +
          '<div class="logo-box">' + icon('book') + '</div>' +
          '<h1>Calura<span>Livros</span></h1>' +
          '<p>Sistema de Gestão de Biblioteca</p>' +
        '</div>' +
        '<div class="login-box">' +
          '<div class="login-tabs">' +
            '<button class="active" id="tab-login">Entrar</button>' +
            '<button id="tab-register">Criar conta</button>' +
          '</div>' +
          '<div id="login-form" class="login-form">' +
            '<div class="input-group"><label>E-mail</label><input type="email" id="login-email" placeholder="seu@email.com" /></div>' +
            '<div class="input-group">' +
              '<label>Senha</label>' +
              '<div style="position:relative">' +
                '<input type="password" id="login-pass" placeholder="Digite sua senha" style="padding-right:40px" />' +
                '<button id="toggle-pass" class="toggle-pass">' + icon('eyeOff') + '</button>' +
              '</div>' +
            '</div>' +
            '<button class="btn btn-primary" style="width:100%" id="btn-login">Entrar</button>' +
          '</div>' +
          '<div id="register-form" class="login-form" style="display:none">' +
            '<div class="input-group"><label>Nome</label><input type="text" id="reg-name" placeholder="Seu nome" /></div>' +
            '<div class="input-group"><label>E-mail</label><input type="email" id="reg-email" placeholder="seu@email.com" /></div>' +
            '<div class="input-group"><label>Senha</label><input type="password" id="reg-pass" placeholder="Mínimo 6 caracteres" /></div>' +
            '<button class="btn btn-primary" style="width:100%" id="btn-register">Criar conta</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function bindLogin() {
  // --- Abas de Login / Registro ---
  var tabLogin = document.getElementById('tab-login');
  var tabReg = document.getElementById('tab-register');
  var formLogin = document.getElementById('login-form');
  var formReg = document.getElementById('register-form');

  if (tabLogin) {
    tabLogin.onclick = function () {
      tabLogin.classList.add('active');
      if (tabReg) tabReg.classList.remove('active');
      formLogin.style.display = '';
      formReg.style.display = 'none';
    };
  }
  if (tabReg) {
    tabReg.onclick = function () {
      tabReg.classList.add('active');
      if (tabLogin) tabLogin.classList.remove('active');
      formReg.style.display = '';
      formLogin.style.display = 'none';
    };
  }

  // --- Botão mostrar/ocultar senha ---
  var togglePass = document.getElementById('toggle-pass');
  if (togglePass) {
    togglePass.onclick = function () {
      var input = document.getElementById('login-pass');
      if (input.type === 'password') {
        input.type = 'text';
        togglePass.innerHTML = icon('eyeOn');
      } else {
        input.type = 'password';
        togglePass.innerHTML = icon('eyeOff');
      }
    };
  }

  // --- Botão Entrar ---
  var btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', function () {
      var email = document.getElementById('login-email');
      var senha = document.getElementById('login-pass');
      if (!email || !senha) return;

      var e = email.value.trim();
      var s = senha.value;
      if (!e || !s) { showToast('Preencha e-mail e senha', true); return; }
      handleLogin(e, s);
    });
  }

  // --- Botão Criar Conta ---
  var btnRegister = document.getElementById('btn-register');
  if (btnRegister) {
    btnRegister.addEventListener('click', async function () {
      var nomeEl = document.getElementById('reg-name');
      var emailEl = document.getElementById('reg-email');
      var senhaEl = document.getElementById('reg-pass');
      if (!nomeEl || !emailEl || !senhaEl) return;

      var nome = nomeEl.value.trim();
      var email = emailEl.value.trim();
      var senha = senhaEl.value;
      if (!nome || !email || !senha) { showToast('Preencha todos os campos', true); return; }
      if (senha.length < 6) { showToast('Senha: mínimo 6 caracteres', true); return; }

      try {
        // Cria o usuário e já faz login automático
        await createUser({ nome: nome, email: email, senha: senha });
        await handleLogin(email, senha);
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }
}

// ================================================================
//  LAYOUT (estrutura comum a todas as telas internas)
// ================================================================

function renderLayout() {
  var titulos = {
    dashboard: 'Catálogo',
    'my-loans': 'Minhas Reservas',
    'admin-books': 'Gerenciar Livros',
    'admin-loans': 'Gerenciar Reservas',
  };

  return (
    '<div class="app-layout">' +
      renderSidebar() +
      '<div class="app-main">' +
        '<header class="topbar">' +
          '<div class="topbar-left">' +
            '<button class="topbar-menu" id="menu-btn">' + icon('menu') + '</button>' +
            '<h1>' + (titulos[state.screen] || 'Calura Livros') + '</h1>' +
          '</div>' +
          '<div class="topbar-right">' +
            '<div class="topbar-user">' +
              '<div class="topbar-avatar">' + (state.user ? state.user.nome[0] : 'A') + '</div>' +
              '<span class="topbar-name">' + (state.user ? state.user.nome : 'Usuário') + '</span>' +
            '</div>' +
          '</div>' +
        '</header>' +
        '<main class="app-content" id="content"></main>' +
      '</div>' +
      (state.sidebarOpen ? '<div class="overlay" id="overlay"></div>' : '') +
    '</div>'
  );
}

function renderSidebar() {
  // Itens diferentes para admin e usuário comum
  var itens;
  if (state.isAdmin) {
    itens = [
      { icon: 'home', label: 'Catálogo', screen: 'dashboard' },
      { icon: 'book', label: 'Livros', screen: 'admin-books' },
      { icon: 'clipboard', label: 'Reservas', screen: 'admin-loans' },
    ];
  } else {
    itens = [
      { icon: 'home', label: 'Início', screen: 'dashboard' },
      { icon: 'clipboard', label: 'Minhas Reservas', screen: 'my-loans' },
    ];
  }

  // Gera os botões do menu
  var botoesNav = '';
  for (var i = 0; i < itens.length; i++) {
    var item = itens[i];
    var ativo = state.screen === item.screen ? ' active' : '';
    botoesNav +=
      '<button class="' + ativo + '" data-nav="' + item.screen + '">' +
        icon(item.icon) + ' <span class="nav-label">' + item.label + '</span>' +
      '</button>';
  }

  return (
    '<aside class="sidebar' + (state.sidebarOpen ? ' open' : '') + '">' +
      '<div class="sidebar-logo">' +
        '<div class="logo-icon">' + icon('book') + '</div>' +
        '<span class="logo-text">Calura<span>Livros</span></span>' +
      '</div>' +
      '<nav class="sidebar-nav">' + botoesNav + '</nav>' +
      '<div class="sidebar-footer">' +
        '<button class="logout-btn" id="btn-logout">' + icon('logout') + ' <span class="nav-label">Sair</span></button>' +
      '</div>' +
    '</aside>'
  );
}

function bindLayout() {
  // Botão menu (mobile)
  var menuBtn = document.getElementById('menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      state.sidebarOpen = !state.sidebarOpen;
      render();
    });
  }

  // Overlay escuro - fecha sidebar ao clicar
  var overlay = document.getElementById('overlay');
  if (overlay) {
    overlay.addEventListener('click', function () {
      state.sidebarOpen = false;
      render();
    });
  }

  // Botão Sair
  var btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);

  // Navegação pela sidebar (data-nav="nomeTela")
  var botoes = document.querySelectorAll('[data-nav]');
  for (var i = 0; i < botoes.length; i++) {
    botoes[i].addEventListener('click', function () {
      navigate(this.dataset.nav);
    });
  }

  renderContent();
}

// ================================================================
//  ROTEADOR DE CONTEÚDO
//  Renderiza a tela certa dentro da área de conteúdo
// ================================================================

function renderContent() {
  var container = document.getElementById('content');
  if (!container) return;

  // Estado: carregando dados da API
  if (state.loading) {
    container.innerHTML = '<div class="center-msg"><p>Carregando...</p></div>';
    return;
  }

  // Estado: API offline
  if (state._apiOffline) {
    container.innerHTML =
      '<div class="center-msg">' +
        '<h2>API Indisponível</h2>' +
        '<p>Verifique se o servidor está rodando na porta 3031.</p>' +
        '<button class="btn btn-primary" onclick="loadData()">Tentar novamente</button>' +
      '</div>';
    return;
  }

  // Escolhe a tela baseado no state.screen
  switch (state.screen) {
    case 'dashboard':
      container.innerHTML = renderDashboard();
      bindDashboard();
      break;
    case 'my-loans':
      container.innerHTML = renderMyLoans();
      bindMyLoans();
      break;
    case 'admin-books':
      container.innerHTML = renderAdminBooks();
      bindAdminBooks();
      break;
    case 'admin-loans':
      container.innerHTML = renderAdminLoans();
      bindAdminLoans();
      break;
  }
}

// ================================================================
//  TELA: CATÁLOGO DE LIVROS (usuário comum e admin)
//  Busca, paginação de 50 em 50, botão Reservar
// ================================================================

function renderDashboard() {
  return (
    '<div class="catalog-header">' +
      '<h2>Olá, ' + (state.user ? state.user.nome.split(' ')[0] : 'Visitante') + '!</h2>' +
      '<div class="search-box">' +
        icon('search') +
        '<input type="text" id="search-input" placeholder="Buscar por título ou autor..." />' +
      '</div>' +
    '</div>' +
    '<section>' +
      '<h2 id="catalog-title">Catálogo <span>(' + state.books.length + ' livros)</span></h2>' +
      '<div class="books-grid" id="books-grid"></div>' +
      '<div id="pagination"></div>' +
    '</section>'
  );
}

// HTML de um card de livro no grid
function renderBookCard(book) {
  var disponivel = book.available > 0;
  return (
    '<div class="book-card">' +
      '<div class="book-cover"><img src="' + book.cover + '" alt="' + book.title + '" loading="lazy" /></div>' +
      '<div class="book-info">' +
        '<div class="book-title">' + book.title + '</div>' +
        '<div class="book-author">' + book.author + '</div>' +
        '<span class="badge ' + (disponivel ? 'badge-green' : 'badge-red') + '">' + (disponivel ? 'Disponível' : 'Emprestado') + '</span>' +
        '<button class="btn btn-sm ' + (disponivel ? 'btn-primary' : 'btn-ghost') + '" data-borrow="' + book.id + '" ' + (!disponivel ? 'disabled' : '') + '>' +
          (disponivel ? 'Reservar' : 'Indisponível') +
        '</button>' +
      '</div>' +
    '</div>'
  );
}

function bindDashboard() {
  var searchQuery = '';
  var currentPage = 1;
  var PAGE_SIZE = 50;

  // Função que filtra, pagina e renderiza os livros
  function filterBooks() {
    // 1. Filtra por busca (título ou autor)
    var list = state.books;
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      list = list.filter(function (b) {
        return b.title.toLowerCase().indexOf(q) !== -1 || b.author.toLowerCase().indexOf(q) !== -1;
      });
    }

    // 2. Calcula total de páginas e ajusta página atual se necessário
    var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    // 3. Pega só os itens da página atual
    var start = (currentPage - 1) * PAGE_SIZE;
    var pageItems = list.slice(start, start + PAGE_SIZE);

    // 4. Renderiza grid de livros
    var grid = document.getElementById('books-grid');
    if (grid) {
      if (pageItems.length === 0) {
        grid.innerHTML = '<div class="empty-msg">Nenhum livro encontrado</div>';
      } else {
        grid.innerHTML = pageItems.map(renderBookCard).join('');
      }
    }

    // 5. Atualiza título da seção
    var title = document.getElementById('catalog-title');
    if (title) {
      if (searchQuery) {
        title.innerHTML = 'Busca: "' + searchQuery + '" <span>(' + list.length + ')</span>';
      } else {
        title.innerHTML = 'Catálogo <span>(' + list.length + ' livros)</span>';
      }
    }

    // 6. Renderiza paginação (botões Anterior / Próximo)
    var pagEl = document.getElementById('pagination');
    if (pagEl) {
      if (totalPages <= 1) {
        pagEl.innerHTML = '';
      } else {
        pagEl.innerHTML =
          '<div class="pag-btns">' +
            '<button class="pag-btn" data-page="' + (currentPage - 1) + '" ' + (currentPage === 1 ? 'disabled' : '') + '>' + icon('arrowLeft') + '</button>' +
            '<span class="pag-info">' + currentPage + ' / ' + totalPages + '</span>' +
            '<button class="pag-btn" data-page="' + (currentPage + 1) + '" ' + (currentPage === totalPages ? 'disabled' : '') + '>' + icon('arrowRight') + '</button>' +
          '</div>';

        // Eventos nos botões de paginação
        var pagBtns = pagEl.querySelectorAll('.pag-btn:not([disabled])');
        for (var i = 0; i < pagBtns.length; i++) {
          pagBtns[i].addEventListener('click', function () {
            currentPage = parseInt(this.dataset.page);
            filterBooks();
          });
        }
      }
    }

    // 7. Vincula eventos aos botões "Reservar" dos cards
    var borrowBtns = document.querySelectorAll('[data-borrow]');
    for (var j = 0; j < borrowBtns.length; j++) {
      borrowBtns[j].addEventListener('click', function (e) {
        e.stopPropagation();
        handleBorrow(parseInt(this.dataset.borrow));
      });
    }
  }

  // Input de busca: filtra ao digitar (volta para página 1)
  var searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function (e) {
      searchQuery = e.target.value;
      currentPage = 1;
      filterBooks();
    });
  }

  // Renderização inicial
  filterBooks();
}

// Reserva um livro (chama a API e recarrega os dados)
async function handleBorrow(bookId) {
  if (!state.user || isNaN(bookId)) return;
  try {
    var hoje = new Date().toISOString().split('T')[0];
    await createReservation({
      data_reserva: hoje,
      id_usuario: state.user.id,
      id_livro: bookId,
    });
    showToast('Reserva solicitada!');
    await loadData();
  } catch (erro) {
    showToast(erro.message, true);
  }
}

// ================================================================
//  TELA: MINHAS RESERVAS (usuário comum)
//  Lista reservas ativas (com botão Devolver) + histórico
// ================================================================

function renderMyLoans() {
  // Filtra só as reservas do usuário logado
  var minhas = state.user ? state.loans.filter(function (l) { return l.userId === state.user.id; }) : [];
  var ativas = minhas.filter(function (l) { return l.status === 'ATIVA' || l.status === 'ATRASADA'; });
  var historico = minhas.filter(function (l) { return l.status === 'DEVOLVIDO' || l.status === 'CANCELADA'; });

  return (
    '<section>' +
      '<h2>Reservas Ativas</h2>' +
      (ativas.length === 0
        ? '<p class="empty-msg">Nenhuma reserva ativa</p>'
        : ativas.map(renderLoanCard).join('')
      ) +
    '</section>' +
    '<section style="margin-top:20px">' +
      '<h2>Histórico</h2>' +
      (historico.length === 0
        ? '<p class="empty-msg">Nenhum histórico</p>'
        : historico.map(function (l) { return renderLoanCard(l, true); }).join('')
      ) +
    '</section>'
  );
}

// Card de uma reserva (usado tanto para ativas quanto histórico)
function renderLoanCard(loan, isHistorico) {
  // Busca dados do livro e aplica fallback
  var book = state.books.find(function (b) { return b.id === loan.bookId; }) || { title: 'Livro', author: '?', cover: COVER_DEFAULT };
  var atrasado = loan.status === 'ATRASADA';

  var html = '<div class="loan-card' + (atrasado ? ' overdue' : '') + '"';

  if (isHistorico) html += ' style="opacity:0.6"';
  html += '>';

  // Capa do livro
  var imgStyle = isHistorico ? ' style="filter:grayscale(1)"' : '';
  html += '<img src="' + book.cover + '" class="loan-cover" alt=""' + imgStyle + ' />';

  // Informações
  html += '<div class="loan-info">';
  html += statusBadge(loan.status);
  html += '<h4>' + book.title + '</h4>';
  html += '<p>' + book.author + '</p>';

  if (!isHistorico) {
    // Datas da reserva ativa
    html += '<div class="loan-dates">';
    if (loan.dataEmprestimo) html += '<span>Retirada: ' + displayDate(loan.dataEmprestimo) + '</span>';
    if (loan.dataPrevista) html += '<span class="' + (atrasado ? 'overdue-txt' : '') + '">Prevista: ' + displayDate(loan.dataPrevista) + '</span>';
    html += '</div>';
  } else {
    // Datas do histórico
    html += '<p style="font-size:12px;color:var(--slate-400)">' + displayDate(loan.dataEmprestimo);
    if (loan.dataDevolucao) html += ' | Devolvido: ' + displayDate(loan.dataDevolucao);
    html += '</p>';
  }

  html += '</div>'; // fecha loan-info

  // Botão Devolver (só para reservas ativas)
  if (!isHistorico) {
    html += '<button class="btn btn-sm btn-success" data-return="' + loan.id + '">' + icon('check') + ' Devolver</button>';
  }

  html += '</div>'; // fecha loan-card
  return html;
}

function bindMyLoans() {
  var botoes = document.querySelectorAll('[data-return]');
  for (var i = 0; i < botoes.length; i++) {
    botoes[i].addEventListener('click', async function () {
      var confirmou = await showConfirmModal('Devolver esta reserva?');
      if (!confirmou) return;
      try {
        await updateReservation(parseInt(this.dataset.return), 'DEVOLVIDO');
        showToast('Devolvido!');
        await loadData();
      } catch (erro) {
        showToast(erro.message, true);
      }
    });
  }
}

// ================================================================
//  TELA ADMIN: GERENCIAR LIVROS
//  Tabela com busca, botão Novo, Editar e Excluir
// ================================================================

function renderAdminBooks() {
  return (
    '<div class="admin-toolbar">' +
      '<div class="search-box" style="flex:1;max-width:320px">' +
        icon('search') +
        '<input type="text" id="admin-search" placeholder="Buscar livros..." />' +
      '</div>' +
      '<button class="btn btn-primary" id="btn-add-book">' + icon('plus') + ' Novo Livro</button>' +
    '</div>' +
    '<div id="book-form"></div>' +
    '<table class="admin-table">' +
      '<thead><tr><th>Livro</th><th>Autor</th><th>Páginas</th><th>Status</th><th>Ações</th></tr></thead>' +
      '<tbody id="books-tbody">' +
        state.books.map(renderAdminBookRow).join('') +
      '</tbody>' +
    '</table>'
  );
}

// Linha da tabela de livros
function renderAdminBookRow(book) {
  var disponivel = book.available > 0;
  return (
    '<tr>' +
      '<td>' +
        '<div class="table-book">' +
          '<img src="' + book.cover + '" alt="" />' +
          '<span>' + book.title + '</span>' +
        '</div>' +
      '</td>' +
      '<td>' + book.author + '</td>' +
      '<td>' + (book.paginas || '-') + '</td>' +
      '<td><span class="badge ' + (disponivel ? 'badge-green' : 'badge-red') + '">' + (disponivel ? 'Disponível' : 'Esgotado') + '</span></td>' +
      '<td class="table-actions">' +
        '<button class="btn btn-sm btn-ghost" data-edit-book="' + book.id + '">Editar</button>' +
        '<button class="btn btn-sm btn-danger" data-delete-book="' + book.id + '">Excluir</button>' +
      '</td>' +
    '</tr>'
  );
}

// Formulário de cadastro/edição de livro
function renderBookForm(book) {
  var editando = !!book; // true se estamos editando, false se for novo
  return (
    '<div class="form-card">' +
      '<h3>' + (editando ? 'Editar Livro' : 'Novo Livro') + '</h3>' +
      '<div class="form-row"><div class="input-group"><label>Título</label><input type="text" id="form-title" value="' + (book ? book.title : '') + '" /></div></div>' +
      '<div class="form-row"><div class="input-group"><label>Autor</label><input type="text" id="form-author" value="' + (book ? book.author : '') + '" /></div></div>' +
      '<div class="form-row"><div class="input-group"><label>Páginas</label><input type="number" id="form-paginas" value="' + (book ? book.paginas : '') + '" min="0" /></div></div>' +
      '<label class="checkbox-label"><input type="checkbox" id="form-available" ' + (!book || book.available > 0 ? 'checked' : '') + ' /> Disponível</label>' +
      '<div class="form-actions">' +
        '<button class="btn btn-primary" id="btn-save-book">Salvar</button>' +
        '<button class="btn btn-ghost" id="btn-cancel-book">Cancelar</button>' +
      '</div>' +
    '</div>'
  );
}

function bindAdminBooks() {
  var formContainer = document.getElementById('book-form');

  // Abre formulário para criar (book=null) ou editar (book=objeto)
  function openForm(book) {
    formContainer.innerHTML = renderBookForm(book);
    formContainer.scrollIntoView({ behavior: 'smooth' });

    document.getElementById('btn-cancel-book').addEventListener('click', function () {
      formContainer.innerHTML = '';
    });

    document.getElementById('btn-save-book').addEventListener('click', async function () {
      var titulo = document.getElementById('form-title').value.trim();
      var autor = document.getElementById('form-author').value.trim();
      var paginas = parseInt(document.getElementById('form-paginas').value, 10) || 0;
      var disponivel = document.getElementById('form-available').checked;

      if (!titulo || !autor) { showToast('Preencha título e autor', true); return; }

      try {
        if (book) {
          await updateBook(book.id, { titulo: titulo, autor: autor, paginas: paginas, disponivel: disponivel });
          showToast('Atualizado!');
        } else {
          await createBook({ titulo: titulo, autor: autor, paginas: paginas, disponivel: disponivel });
          showToast('Criado!');
        }
        await loadData(); // recarrega dados e re-renderiza
      } catch (erro) {
        showToast(erro.message, true);
      }
    });
  }

  // Botão "Novo Livro"
  var btnAdd = document.getElementById('btn-add-book');
  if (btnAdd) btnAdd.addEventListener('click', function () { openForm(null); });

  // Busca na tabela de livros
  var searchInput = document.getElementById('admin-search');
  if (searchInput) {
    searchInput.addEventListener('input', function (e) {
      var query = e.target.value.toLowerCase();
      var filtrados = state.books.filter(function (b) {
        return b.title.toLowerCase().indexOf(query) !== -1 || b.author.toLowerCase().indexOf(query) !== -1;
      });

      var tbody = document.getElementById('books-tbody');
      if (filtrados.length > 0) {
        tbody.innerHTML = filtrados.map(renderAdminBookRow).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum livro encontrado</td></tr>';
      }
      bindTableActions(); // revincula eventos nos novos botões
    });
  }

  // Vincula eventos "Editar" e "Excluir" nos botões da tabela
  function bindTableActions() {
    // Editar
    var editBtns = document.querySelectorAll('[data-edit-book]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function () {
        var id = parseInt(this.dataset.editBook);
        var book = state.books.find(function (b) { return b.id === id; });
        if (book) openForm(book);
      });
    }

    // Excluir (com confirmação)
    var deleteBtns = document.querySelectorAll('[data-delete-book]');
    for (var j = 0; j < deleteBtns.length; j++) {
      deleteBtns[j].addEventListener('click', async function () {
        var confirmou = await showConfirmModal('Excluir este livro e suas reservas?', true);
        if (!confirmou) return;
        try {
          await deleteBook(parseInt(this.dataset.deleteBook));
          showToast('Excluído!');
          await loadData();
        } catch (erro) {
          showToast(erro.message, true);
        }
      });
    }
  }
  bindTableActions(); // inicial
}

// ================================================================
//  TELA ADMIN: GERENCIAR RESERVAS
//  Tabela com botões Devolver e Excluir
// ================================================================

function renderAdminLoans() {
  var loans = state.loans;

  // Gera linhas da tabela
  var linhas = '';
  for (var i = 0; i < loans.length; i++) {
    var loan = loans[i];

    // Busca livro e usuário relacionados
    var book = state.books.find(function (b) { return b.id === loan.bookId; }) || { title: 'Livro', author: '?' };
    var user = state.users.find(function (u) { return u.id_usuario === loan.userId; }) || { nome: 'Usuário' };

    // Só pode devolver se status for ATIVA ou ATRASADA
    var podeDevolver = loan.status === 'ATIVA' || loan.status === 'ATRASADA';

    // Cor da data prevista: vermelho se atrasado
    var corPrevista = loan.status === 'ATRASADA' ? 'var(--red-600)' : 'var(--slate-500)';

    linhas +=
      '<tr>' +
        '<td>' + book.title + ' <span style="color:var(--slate-400);font-size:12px">' + book.author + '</span></td>' +
        '<td>' + user.nome + '</td>' +
        '<td>' + displayDate(loan.dataEmprestimo) + '</td>' +
        '<td style="color:' + corPrevista + '">' + displayDate(loan.dataPrevista) + '</td>' +
        '<td>' + displayDate(loan.dataDevolucao) + '</td>' +
        '<td>' + statusBadge(loan.status) + '</td>' +
        '<td class="table-actions">' +
          (podeDevolver ? '<button class="btn btn-sm btn-success" data-devolve="' + loan.id + '">Devolver</button>' : '') +
          '<button class="btn btn-sm btn-danger" data-delete-loan="' + loan.id + '">Excluir</button>' +
        '</td>' +
      '</tr>';
  }

  if (loans.length === 0) {
    linhas = '<tr><td colspan="7" class="empty-state">Nenhuma reserva</td></tr>';
  }

  return (
    '<table class="admin-table">' +
      '<thead><tr><th>Livro</th><th>Usuário</th><th>Empréstimo</th><th>Prevista</th><th>Devolução</th><th>Status</th><th>Ações</th></tr></thead>' +
      '<tbody>' + linhas + '</tbody>' +
    '</table>'
  );
}

function bindAdminLoans() {
  // Botão Devolver
  var devolveBtns = document.querySelectorAll('[data-devolve]');
  for (var i = 0; i < devolveBtns.length; i++) {
    devolveBtns[i].addEventListener('click', async function () {
      try {
        await updateReservation(parseInt(this.dataset.devolve), 'DEVOLVIDO');
        showToast('Devolvido!');
        await loadData();
      } catch (erro) {
        showToast(erro.message, true);
      }
    });
  }

  // Botão Excluir (com confirmação)
  var deleteBtns = document.querySelectorAll('[data-delete-loan]');
  for (var j = 0; j < deleteBtns.length; j++) {
    deleteBtns[j].addEventListener('click', async function () {
      var confirmou = await showConfirmModal('Excluir esta reserva?', true);
      if (!confirmou) return;
      try {
        await deleteReservation(parseInt(this.dataset.deleteLoan));
        showToast('Excluído!');
        await loadData();
      } catch (erro) {
        showToast(erro.message, true);
      }
    });
  }
}

// ================================================================
//  INICIALIZAÇÃO
//  Ponto de entrada: decide se mostra login ou tela principal
// ================================================================

function init() {
  if (savedSession) {
    // Usuário já estava logado: restaura tela e carrega dados
    state.screen = state.isAdmin ? 'admin-books' : 'dashboard';
    var path = screenToPath[state.screen] || '/';
    history.replaceState({ screen: state.screen }, '', path);
    render();
    loadData();
  } else {
    // Nenhuma sessão salva: mostra login
    state.screen = 'login';
    history.replaceState({ screen: 'login' }, '', '/login');
    render();
  }
}

init();
