type Offer = { id: string; vehicle: string; leftLetter: string; digits: string; rightLetters: string; region: string; priceValue: number; sourceUrl?: string; createdAt: string; publishedAt?: string };
const letters: Record<string, string> = { A:'А', B:'В', C:'С', E:'Е', H:'Н', K:'К', M:'М', O:'О', P:'Р', T:'Т', X:'Х', Y:'У', V:'В' };
function plateKey(row: Offer) {
  const plate = `${row.leftLetter}${row.digits}${row.rightLetters}`.toUpperCase().replace(/[ABCEHKMOPTXYV]/g, c => letters[c]).replace(/[^А-Я0-9]/g, '');
  const region = row.region.trim().match(/\d{1,3}$/)?.[0]?.replace(/^0+(?=\d)/, '') ?? row.region.trim();
  return `${row.vehicle}|${plate}|${region}`;
}
export function deduplicateOffers<T extends Offer>(rows: T[]): T[] {
  // Сетевой ответ идёт после снимка: новая цена того же поста заменяет старую.
  const sources = new Map<string, T>();
  for (const row of rows) {
    const key = row.sourceUrl ? `${row.sourceUrl}|${plateKey(row)}` : `id:${row.id}`;
    const previous = sources.get(key);
    if (!previous || (row.publishedAt ?? row.createdAt) >= (previous.publishedAt ?? previous.createdAt)) sources.set(key, row);
  }
  const offers = new Map<string, T>();
  for (const row of sources.values()) {
    const key = `${plateKey(row)}|${Number(row.priceValue)}`;
    const previous = offers.get(key);
    if (!previous || (row.publishedAt ?? row.createdAt) >= (previous.publishedAt ?? previous.createdAt)) offers.set(key, row);
  }
  return [...offers.values()].sort((a,b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
}

// New pages extend the last successful catalogue, never an older bundled copy.
export function mergeCatalogOffers<T extends Offer>(current: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return current;
  const previous = new Map(current.map(row => [row.id, row]));
  const merged = deduplicateOffers([...current, ...incoming]).map(row => {
    const old = previous.get(row.id);
    if (!old) return row;
    const keys = Object.keys(row) as (keyof T)[];
    return keys.length === Object.keys(old).length && keys.every(key => Object.is(row[key], old[key])) ? old : row;
  });
  // Background page checks often return unchanged records. Preserve identity
  // so React skips rebuilding the catalogue and serializing it to storage.
  return merged.length === current.length && merged.every((row, index) => row === current[index]) ? current : merged;
}
