CREATE DATABASE biblioteca;

USE biblioteca;

CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    senha_salt VARCHAR(64) NOT NULL
);

CREATE TABLE livros (
    id_livro INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    autor VARCHAR(100) NOT NULL,
    disponivel BOOLEAN DEFAULT TRUE
);

CREATE TABLE reservas (
    id_reserva INT AUTO_INCREMENT PRIMARY KEY,
    data_reserva DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'ATIVA',
    id_usuario INT NOT NULL,
    id_livro INT NOT NULL,

    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_livro) REFERENCES livros(id_livro) ON DELETE CASCADE
);
