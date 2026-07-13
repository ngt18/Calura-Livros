const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const fs = require("fs");
const { fetchCoverUrl } = require("../services/openLibrary");

const books = [
  ["Dom Quixote", "Miguel de Cervantes", 992],
  ["Cem Anos de Solidao", "Gabriel Garcia Marquez", 432],
  ["1984", "George Orwell", 328],
  ["O Senhor dos Aneis: A Sociedade do Anel", "J.R.R. Tolkien", 576],
  ["O Pequeno Principe", "Antoine de Saint-Exupery", 96],
  ["Harry Potter e a Pedra Filosofal", "J.K. Rowling", 264],
  ["Orgulho e Preconceito", "Jane Austen", 416],
  ["O Hobbit", "J.R.R. Tolkien", 336],
  ["Crime e Castigo", "Fiodor Dostoievski", 672],
  ["A Revolucao dos Bichos", "George Orwell", 152],
  ["Dom Casmurro", "Machado de Assis", 256],
  ["Guerra e Paz", "Leon Tolstoi", 1440],
  ["Grande Sertao: Veredas", "Guimaraes Rosa", 608],
  ["Memorias Postumas de Bras Cubas", "Machado de Assis", 240],
  ["Macunaima", "Mario de Andrade", 192],
  ["Vidas Secas", "Graciliano Ramos", 184],
  ["O Cortico", "Aluisio Azevedo", 304],
  ["Capitaes da Areia", "Jorge Amado", 320],
  ["Iracema", "Jose de Alencar", 176],
  ["O Guarani", "Jose de Alencar", 416],
  ["Senhora", "Jose de Alencar", 272],
  ["O Primo Basilio", "Eca de Queiros", 448],
  ["Os Maias", "Eca de Queiros", 720],
  ["O Alienista", "Machado de Assis", 112],
  ["A Moreninha", "Joaquim Manuel de Macedo", 280],
  ["Memorias de um Sargento de Milicias", "Manuel Antonio de Almeida", 336],
  ["Triste Fim de Policarpo Quaresma", "Lima Barreto", 368],
  ["O Ateneu", "Raul Pompeia", 312],
  ["A Escrava Isaura", "Bernardo Guimaraes", 224],
  ["O Senhor dos Aneis: As Duas Torres", "J.R.R. Tolkien", 496],
  ["O Senhor dos Aneis: O Retorno do Rei", "J.R.R. Tolkien", 560],
  ["Harry Potter e a Camara Secreta", "J.K. Rowling", 288],
  ["Harry Potter e o Prisioneiro de Azkaban", "J.K. Rowling", 360],
  ["Harry Potter e o Calice de Fogo", "J.K. Rowling", 480],
  ["Harry Potter e a Ordem da Fenix", "J.K. Rowling", 720],
  ["Harry Potter e o Enigma do Principe", "J.K. Rowling", 608],
  ["Harry Potter e as Reliquias da Morte", "J.K. Rowling", 704],
  ["Lolita", "Vladimir Nabokov", 368],
  ["Ulisses", "James Joyce", 1056],
  ["Em Busca do Tempo Perdido", "Marcel Proust", 2400],
  ["O Som e a Furia", "William Faulkner", 384],
  ["O Morro dos Ventos Uivantes", "Emily Bronte", 416],
  ["Jane Eyre", "Charlotte Bronte", 544],
  ["Mrs. Dalloway", "Virginia Woolf", 224],
  ["Ao Farol", "Virginia Woolf", 240],
  ["Grandes Esperancas", "Charles Dickens", 656],
  ["Um Conto de Duas Cidades", "Charles Dickens", 544],
  ["Oliver Twist", "Charles Dickens", 576],
  ["Moby Dick", "Herman Melville", 720],
  ["O Grande Gatsby", "F. Scott Fitzgerald", 208],
  ["Admiravel Mundo Novo", "Aldous Huxley", 352],
  ["Laranja Mecanica", "Anthony Burgess", 224],
  ["O Apanhador no Campo de Centeio", "J.D. Salinger", 240],
  ["Matadouro 5", "Kurt Vonnegut", 288],
  ["O Conto da Aia", "Margaret Atwood", 336],
  ["O Nome da Rosa", "Umberto Eco", 552],
  ["O Codigo da Vinci", "Dan Brown", 432],
  ["Anjos e Demonios", "Dan Brown", 480],
  ["Inferno", "Dan Brown", 480],
  ["Fortaleza Digital", "Dan Brown", 368],
  ["Dracula", "Bram Stoker", 432],
  ["Frankenstein", "Mary Shelley", 304],
  ["O Medico", "Noah Gordon", 736],
  ["O Chamado de Cthulhu", "H.P. Lovecraft", 128],
  ["O Exorcista", "William Peter Blatty", 416],
  ["O Iluminado", "Stephen King", 544],
  ["It: A Coisa", "Stephen King", 1184],
  ["Carrie, a Estranha", "Stephen King", 256],
  ["A Torre Negra: O Pistoleiro", "Stephen King", 256],
  ["O Cemiterio", "Stephen King", 416],
  ["Misery", "Stephen King", 368],
  ["Farenheit 451", "Ray Bradbury", 216],
  ["Eu, Robo", "Isaac Asimov", 256],
  ["Fundacao", "Isaac Asimov", 256],
  ["Duna", "Frank Herbert", 688],
  ["Neuromancer", "William Gibson", 320],
  ["Snow Crash", "Neal Stephenson", 480],
  ["O Guia do Mochileiro das Galaxias", "Douglas Adams", 224],
  ["A Metamorfose", "Franz Kafka", 96],
  ["O Processo", "Franz Kafka", 288],
  ["O Castelo", "Franz Kafka", 384],
  ["O Estrangeiro", "Albert Camus", 160],
  ["A Peste", "Albert Camus", 352],
  ["A Queda", "Albert Camus", 160],
  ["A Nausea", "Jean-Paul Sartre", 288],
  ["O Mito de Sisifo", "Albert Camus", 160],
  ["Carta ao Pai", "Franz Kafka", 96],
  ["O Sol e para Todos", "Harper Lee", 288],
  ["A Menina que Roubava Livros", "Markus Zusak", 480],
  ["O Menino do Pijama Listrado", "John Boyne", 224],
  ["A Culpa e das Estrelas", "John Green", 336],
  ["Como Eu Era Antes de Voce", "Jojo Moyes", 384],
  ["E Assim que Acaba", "Colleen Hoover", 384],
  ["Vermelho, Branco e Sangue Azul", "Casey McQuiston", 448],
  ["Percy Jackson e o Ladrao de Raios", "Rick Riordan", 416],
  ["Jogos Vorazes", "Suzanne Collins", 400],
  ["O Apanhador de Sonhos", "Stephen King", 736],
  ["O Restaurante no Fim do Universo", "Douglas Adams", 256],
  ["A Vida, o Universo e Tudo Mais", "Douglas Adams", 224],
  ["Os Trabalhos de Persiles e Sigismunda", "Miguel de Cervantes", 416],
];

const done = new Set();

function escapeSql(val) {
  return val.replace(/'/g, "''");
}

async function main() {
  const lines = [
    "USE biblioteca;",
    "",
    "-- ============================================================",
    "-- 100 LIVROS MAIS FAMOSOS (com capas do Open Library)",
    "-- ============================================================",
    "",
    "INSERT INTO livros (titulo, autor, paginas, disponivel, imagem) VALUES",
  ];

  const inserts = [];

  let idx = 0;
  for (const [titulo, autor, paginas] of books) {
    const key = `${titulo}|${autor}`;
    if (done.has(key)) continue;
    done.add(key);
    idx++;

    process.stdout.write(`[${idx}/100] ${titulo}... `);
    const cover = await fetchCoverUrl(titulo, autor);
    const img = cover ? `'${cover}'` : "NULL";
    const linha = `('${escapeSql(titulo)}', '${escapeSql(autor)}', ${paginas}, TRUE, ${img})`;

    if (cover) {
      process.stdout.write("OK\n");
    } else {
      process.stdout.write("sem capa\n");
    }

    inserts.push(linha);

    await new Promise((r) => setTimeout(r, 400));
  }

  lines.push("  " + inserts.join(",\n  ") + ";");
  lines.push("");
  lines.push("-- ============================================================");
  lines.push("-- USUARIOS DE EXEMPLO (senha padrao: 123456)");
  lines.push("-- ============================================================");
  lines.push("");
  lines.push("INSERT INTO usuarios (nome, email, senha_hash, senha_salt) VALUES");
  lines.push("  ('Ana Silva', 'ana@email.com', '', ''),");
  lines.push("  ('Carlos Oliveira', 'carlos@email.com', '', ''),");
  lines.push("  ('Mariana Santos', 'mariana@email.com', '', ''),");
  lines.push("  ('Pedro Costa', 'pedro@email.com', '', ''),");
  lines.push("  ('Julieta Mendes', 'julieta@email.com', '', ''),");
  lines.push("  ('Rafael Souza', 'rafael@email.com', '', ''),");
  lines.push("  ('Luiza Alves', 'luiza@email.com', '', ''),");
  lines.push("  ('Felipe Rocha', 'felipe@email.com', '', ''),");
  lines.push("  ('Beatriz Campos', 'beatriz@email.com', '', ''),");
  lines.push("  ('Lucas Barbosa', 'lucas@email.com', '', ''),");
  lines.push("  ('Administrador', 'admin@caluralivros.com', '', '');");

  const output = lines.join("\n");

  const outPath = path.resolve(__dirname, "../database/seed.sql");
  fs.writeFileSync(outPath, output, "utf-8");
  console.log(`\nseed.sql gerado em ${outPath}`);
}

main();
