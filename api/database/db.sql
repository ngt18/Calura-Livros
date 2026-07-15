-- ================================================================
--  Calura Livros - Esquema do banco de dados (MySQL)
--  3 tabelas: usuarios, livros e reservas.
--  Relacionamento: usuarios (1) -> (N) reservas (N) <- (1) livros
--  Ou seja: um usuário pode ter várias reservas, um livro pode
--  aparecer em várias reservas (histórico), mas cada reserva é
--  sempre de UM usuário para UM livro.
-- ================================================================

-- Cria o banco de dados usado por toda a aplicação
CREATE DATABASE biblioteca;

-- Todos os comandos abaixo passam a valer dentro desse banco
USE biblioteca;

-- ----------------------------------------------------------------
-- Tabela USUARIOS: quem pode logar no sistema (aluno/leitor ou admin)
-- ----------------------------------------------------------------
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    -- UNIQUE impede, no próprio banco, dois cadastros com o mesmo email
    -- (mesmo que alguém tente burlar a validação lá no frontend/backend)
    email VARCHAR(100) NOT NULL UNIQUE,
    -- Senha NUNCA é guardada em texto puro. Guardamos o hash (resultado de
    -- uma função criptográfica de mão única) e o salt (valor aleatório
    -- usado no cálculo do hash) em colunas separadas
    senha_hash VARCHAR(255) NOT NULL,
    senha_salt VARCHAR(64) NOT NULL,
    -- Marca quem é administrador (pode cadastrar livros, gerenciar
    -- usuários e reservas de todo mundo). Por padrão, ninguém é admin
    is_admin BOOLEAN DEFAULT FALSE
);

-- ----------------------------------------------------------------
-- Tabela LIVROS: o catálogo/acervo da biblioteca
-- ----------------------------------------------------------------
CREATE TABLE livros (
    id_livro INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    autor VARCHAR(100) NOT NULL,
    -- Número de páginas do livro - usado na regra que calcula o prazo
    -- de devolução (livro mais grosso, prazo maior)
    paginas INT DEFAULT 0,
    -- Se está livre para reserva (TRUE) ou já emprestado (FALSE)
    disponivel BOOLEAN DEFAULT TRUE,
    -- URL da imagem de capa do livro (ex.: vindo do Open Library)
    imagem VARCHAR(500)
);

-- ----------------------------------------------------------------
-- Tabela RESERVAS: liga um usuário a um livro (o "empréstimo")
-- É a tabela que representa o relacionamento entre usuarios e livros,
-- guardando também o histórico de cada empréstimo
-- ----------------------------------------------------------------
CREATE TABLE reservas (
    id_reserva INT AUTO_INCREMENT PRIMARY KEY,
    -- As 4 datas abaixo contam a "história" da reserva, do pedido até a
    -- devolução:
    -- 1) quando o pedido/reserva foi feito
    data_reserva DATE NOT NULL,
    -- 2) quando o livro foi retirado de fato (emprestado)
    data_emprestimo DATE,
    -- 3) prazo combinado para devolução
    data_prevista DATE,
    -- 4) quando foi devolvido de verdade (fica NULL enquanto não devolvido)
    data_devolucao DATE,
    -- Situação atual da reserva: ATIVA, ATRASADA, DEVOLVIDO ou CANCELADA
    status VARCHAR(30) DEFAULT 'ATIVA',
    id_usuario INT NOT NULL,
    id_livro INT NOT NULL,

    -- ON DELETE CASCADE: se o usuário (ou o livro) referenciado for
    -- apagado, as reservas relacionadas a ele somem juntas automaticamente
    -- - evita ficar com reservas "órfãs", apontando pra um usuário/livro
    -- que não existe mais
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_livro) REFERENCES livros(id_livro) ON DELETE CASCADE
);