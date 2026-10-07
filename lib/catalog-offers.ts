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
