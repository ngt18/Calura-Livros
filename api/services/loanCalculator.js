function calcularDiasEmprestimo(paginas) {
  const p = Number(paginas) || 0;
  if (p <= 150) return 7;
  if (p <= 300) return 10;
  if (p <= 500) return 15;
  return 20;
}

function calcularDataPrevista(dataEmprestimo, paginas) {
  const dias = calcularDiasEmprestimo(paginas);
  const data = new Date(dataEmprestimo);
  data.setDate(data.getDate() + dias);
  return data.toISOString().split('T')[0];
}

function calcularStatus(dataDevolucao, dataPrevista) {
  if (dataDevolucao) return 'DEVOLVIDO';
  if (!dataPrevista) return 'ATIVA';
  const hoje = new Date().toISOString().split('T')[0];
  if (hoje > dataPrevista) return 'ATRASADA';
  return 'ATIVA';
}

module.exports = { calcularDiasEmprestimo, calcularDataPrevista, calcularStatus };