# Calura Livros 📚

Sistema de gerenciamento de biblioteca com reservas, prazos automáticos e controle de status.

## Requisitos

- **Node.js** 18+
- **MySQL** 8.0+
- Navegador moderno (Chrome, Edge, Firefox)

## Como rodar

### 1. Banco de dados

Crie o banco no MySQL:

```sql
CREATE DATABASE biblioteca;
```

Ou execute o script SQL direto:

```bash
mysql -u root -p < api/database/db.sql
```

### 2. Backend (API)

```bash
cd api
npm install
npm run dev
```

A API roda em `http://localhost:3031`.

### 3. Frontend

```bash
cd frontend
node server.js
```

O frontend roda em `http://localhost:5173`.

> O frontend é uma SPA sem dependências — não precisa de `npm install`.

### 4. Acessar

Abra `http://localhost:5173` no navegador.

## Login

| Tipo | Email | Senha |
|------|-------|-------|
| Admin | `admin@caluralivros.com` | `123456` |
| Usuário | `joao@email.com` | `123456` |

Demais usuários do seed: `maria@email.com`, `carlos@email.com`, `ana@email.com` etc. (senha: `123456`)

## Funcionalidades

### Usuário
- Cadastro e login
- Catálogo com busca, filtro por categorias e paginação
- Reserva de livros com prazo automático baseado em número de páginas
- Visualização de reservas ativas com status e dias restantes
- Perfil com estatísticas pessoais

### Administrador
- Dashboard com estatísticas gerais e alertas de atraso
- Gestão completa de livros (CRUD)
- Gestão de usuários (CRUD)
- Gestão de reservas (devolver, cancelar, excluir)

### Regras de negócio
- Prazo de empréstimo por faixa de páginas:
  - Até 150 páginas → 7 dias
  - 151 a 300 páginas → 10 dias
  - 301 a 500 páginas → 15 dias
  - Acima de 500 páginas → 20 dias
- Status calculado automaticamente: EM_ANDAMENTO, ATRASADO, DEVOLVIDO, CANCELADO
- Controle de concorrência com transações SQL (`FOR UPDATE`)

## Estrutura do projeto

```
Calura-Livros/
├── api/                      # Backend REST
│   ├── server.js             # Entrypoint Express
│   ├── routes/               # Rotas (book, user, reservation)
│   ├── controllers/          # Lógica dos endpoints
│   ├── services/             # Loan calculator, Open Library
│   ├── middleware/            # Auth JWT + admin
│   ├── database/              # Conexão, schema e seed
│   └── scripts/              # Utilitários (setupAdmin, seed gen)
├── frontend/                 # SPA vanilla JS
│   ├── server.js             # Servidor HTTP estático
│   ├── index.html            # HTML único
│   ├── app.js                # Lógica da SPA (roteamento, telas)
│   ├── api.js                # Cliente HTTP para API
│   └── styles.css            # Estilos responsivos
├── DER biblioteca.png        # Diagrama entidade-relacionamento
└── requisitos.txt            # Requisitos funcionais e não funcionais
```

## Tecnologias

- **Backend:** Node.js, Express 5, MySQL 2, JWT
- **Frontend:** Vanilla JS (SPA), CSS Grid, history.pushState
- **Segurança:** scrypt + salt, timingSafeEqual, JWT com expiração
- **API externa:** Open Library (capas de livros)

## Scripts úteis

```bash
# Criar/atualizar admin
cd api && node scripts/setupAdmin.js

# Regenerar seed com dados da Open Library
cd api && node scripts/generateSeed.js

# Atualizar capas de livros no banco
cd api && node scripts/fetchCovers.js
```
