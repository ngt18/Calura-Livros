// ================================================================
//  Serviço de Busca de Capas - Open Library
//  Busca a URL da imagem de capa de um livro na API pública e
//  gratuita Open Library (openlibrary.org), a partir do título e
//  do autor do livro.
//  IMPORTANTE: usado só pelos scripts offline (generateSeed.js e
//  fetchCovers.js). Nenhuma rota da API chama este arquivo - ou seja,
//  o usuário final do sistema NUNCA dispara uma chamada externa
//  enquanto usa o site.
// ================================================================

// Endpoint de busca por texto: recebe "?q=titulo+autor" e devolve
// metadados dos livros encontrados (entre eles, o id da capa)
const OPEN_LIBRARY_SEARCH = "https://openlibrary.org/search.json?q=";
// Endpoint que gera a imagem da capa a partir do id encontrado na busca
const OPEN_LIBRARY_COVER = "https://covers.openlibrary.org/b/id/";

// Remove artigo inicial do título (ex: "O Hobbit" -> "Hobbit"), para
// a busca achar o livro mesmo se ele estiver com ou sem artigo na frente
function stripLeadingArticles(title) {
  return title.replace(/^(o |a |os |as |the |le |la |les |der |die |das )/i, "");
}

// ================================================================
//  MONTAGEM DAS BUSCAS
//  Monta várias variações da busca para aumentar a chance de achar
//  o livro, já que a Open Library nem sempre acha com a busca "exata"
// ================================================================
function buildQueries(titulo, autor) {
  const queries = [];

  // Tentativa 1: título + autor completos
  queries.push(`${titulo} ${autor}`);

  // Tentativa 2: título + autor sem abreviação inicial (ex: remove "J.R.R. ")
  queries.push(`${titulo} ${autor.replace(/^[^.]+\.\s*/, "")}`);

  // Tentativa 3: só o título
  queries.push(titulo);

  // Tentativa 4: título sem artigo inicial + autor
  const stripped = stripLeadingArticles(titulo);
  if (stripped !== titulo) {
    queries.push(`${stripped} ${autor}`);
  }

  // Remove buscas duplicadas (Set não permite valores repetidos)
  return [...new Set(queries)];
}

// ================================================================
//  BUSCA DA CAPA
//  Tenta cada variação de busca até achar uma capa. Retorna a URL
//  pronta da imagem, ou null se nenhuma variação encontrar nada.
// ================================================================
async function fetchCoverUrl(titulo, autor) {
  const queries = buildQueries(titulo, autor);

  for (const q of queries) {
    const url = OPEN_LIBRARY_SEARCH + encodeURIComponent(q);
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (!data.docs || data.docs.length === 0) continue;

      // Usa só o primeiro resultado retornado pela busca
      const first = data.docs[0];

      // cover_i é o formato mais comum de id de capa
      if (first.cover_i) {
        return `${OPEN_LIBRARY_COVER}${first.cover_i}-L.jpg`;
      }

      // Alguns registros só trazem cover_edition_key em vez de cover_i
      if (first.cover_edition_key) {
        return `${OPEN_LIBRARY_COVER}${first.cover_edition_key}-L.jpg`;
      }
    } catch {
      // Erro de rede numa variação não pode travar a busca do livro
      // inteiro - simplesmente tenta a próxima variação de busca
      continue;
    }
  }

  // Nenhuma variação encontrou capa
  return null;
}

// Exporta também as peças internas (stripLeadingArticles, buildQueries)
// para permitir reaproveitar ou testar cada etapa isoladamente
module.exports = {
  OPEN_LIBRARY_SEARCH,
  OPEN_LIBRARY_COVER,
  stripLeadingArticles,
  buildQueries,
  fetchCoverUrl,
};
