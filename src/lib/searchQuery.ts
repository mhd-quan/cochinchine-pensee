type Hit = { id: string };
type Engine<T extends Hit> = { search: (query: string) => Promise<{ results: T[] }> };

export async function searchPublication<T extends Hit>(
  engine: Engine<T>,
  query: string,
): Promise<T[]> {
  const terms = [...new Set(query.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [])];
  if (!terms.length) return [];
  if (/^\s*".+"\s*$/.test(query)) return (await engine.search(query)).results;
  // Pagefind also matches an indexed word that is a prefix of the query (Q. → qxyz).
  // Require each complete word while retaining its title-weighted result order.
  if (terms.length === 1) return (await engine.search(`"${terms[0]}"`)).results;
  const [ranked, ...matches] = await Promise.all([
    engine.search(query),
    ...terms.map((term) => engine.search(`"${term}"`)),
  ]);
  const ids = matches.map(({ results }) => new Set(results.map(({ id }) => id)));
  return ranked.results.filter(({ id }) => ids.every((set) => set.has(id)));
}
