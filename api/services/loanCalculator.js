// ================================================================
//  loanCalculator - Regras de negócio do empréstimo (RF05)
//  "Coração" das regras de prazo: define quantos dias o usuário tem
//  para devolver um livro (conforme o nº de páginas), calcula a data
//  prevista de devolução e o status atual (ATIVA/ATRASADA/DEVOLVIDO).
// ================================================================

// Define o prazo de empréstimo (em dias) de acordo com o tamanho do
// livro: quanto mais páginas, mais tempo o usuário tem para ler.
// Regra (RF05): até 150 páginas -> 7 dias
//               até 300 páginas -> 10 dias
//               até 500 páginas -> 15 dias
//               acima de 500    -> 20 dias
function calcularDiasEmprestimo(paginas) {
  const p = Number(paginas) || 0; // converte para número; se vier vazio/inválido, assume 0
  if (p <= 150) return 7;
  if (p <= 300) return 10;
  if (p <= 500) return 15;
  return 20;
}

// Calcula a data prevista de devolução: pega a data do empréstimo e
// soma os dias de prazo (calculados acima pela quantidade de páginas).
// Sempre devolve no formato "AAAA-MM-DD", igual ao usado no banco.
function calcularDataPrevista(dataEmprestimo, paginas) {
  const dias = calcularDiasEmprestimo(paginas);
  const data = new Date(dataEmprestimo);
  data.setDate(data.getDate() + dias); // avança a data em "dias" dias
  return data.toISOString().split('T')[0]; // toISOString() = "AAAA-MM-DDTHH:mm:ss.sssZ"; ficamos só com a parte da data
}

// Descobre o status "ao vivo" da reserva a partir das datas gravadas:
// - já tem data_devolucao preenchida?  -> DEVOLVIDO (encerrada)
// - não tem data prevista definida?    -> ATIVA (caso de segurança)
// - hoje já passou da data prevista?   -> ATRASADA
// - senão                              -> ATIVA (ainda dentro do prazo)
function calcularStatus(dataDevolucao, dataPrevista) {
  if (dataDevolucao) return 'DEVOLVIDO';
  if (!dataPrevista) return 'ATIVA';
  const hoje = new Date().toISOString().split('T')[0];
  // Comparação de datas como STRING (ex.: "2026-07-15" > "2026-07-10"):
  // isso funciona porque as datas estão no formato ISO AAAA-MM-DD, e
  // nesse formato a ordem alfabética (lexicográfica) coincide com a
  // ordem cronológica real (compara primeiro o ano, depois o mês,
  // depois o dia - cada parte tem tamanho fixo, então não há ambiguidade).
  if (hoje > dataPrevista) return 'ATRASADA';
  return 'ATIVA';
}

// Exporta as três funções para serem usadas pelos controllers
// (ex.: reservationController usa essas funções ao criar/consultar reservas)
module.exports = { calcularDiasEmprestimo, calcularDataPrevista, calcularStatus };