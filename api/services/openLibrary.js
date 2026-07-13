const OPEN_LIBRARY_SEARCH = "https://openlibrary.org/search.json?q=";
const OPEN_LIBRARY_COVER = "https://covers.openlibrary.org/b/id/";

function stripLeadingArticles(title) {
  return title.replace(/^(o |a |os |as |the |le |la |les |der |die |das )/i, "");
}

function buildQueries(titulo, autor) {
  const queries = [];

  queries.push(`${titulo} ${autor}`);

  queries.push(`${titulo} ${autor.replace(/^[^.]+\.\s*/, "")}`);

  queries.push(titulo);

  const stripped = stripLeadingArticles(titulo);
  if (stripped !== titulo) {
    queries.push(`${stripped} ${autor}`);
  }

  return [...new Set(queries)];
}

async function fetchCoverUrl(titulo, autor) {
  const queries = buildQueries(titulo, autor);

  for (const q of queries) {
    const url = OPEN_LIBRARY_SEARCH + encodeURIComponent(q);
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (!data.docs || data.docs.length === 0) continue;

      const first = data.docs[0];

      if (first.cover_i) {
        return `${OPEN_LIBRARY_COVER}${first.cover_i}-L.jpg`;
      }

      if (first.cover_edition_key) {
        return `${OPEN_LIBRARY_COVER}${first.cover_edition_key}-L.jpg`;
      }
    } catch {
      continue;
    }
  }

  return null;
}

module.exports = {
  OPEN_LIBRARY_SEARCH,
  OPEN_LIBRARY_COVER,
  stripLeadingArticles,
  buildQueries,
  fetchCoverUrl,
};
