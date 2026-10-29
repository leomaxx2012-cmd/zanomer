type SimilarityOffer = { id: string; vehicle: string; leftLetter: string; digits: string; rightLetters: string; region: string };
type SeriesOffer = SimilarityOffer & { seller: string };
type Group = { key: string; size: number };
const digitsKey = (row: SimilarityOffer) => JSON.stringify([row.vehicle, row.digits]);
const lettersKey = (row: SimilarityOffer) => JSON.stringify([row.vehicle, row.leftLetter, row.rightLetters]);
const regionKey = (row: SimilarityOffer) => JSON.stringify([row.vehicle, row.region.split(' · ')[1]?.trim()]);

export function buildSimilarityCounts(rows: readonly SimilarityOffer[]) {
  const digits = new Map<string, number>(), letters = new Map<string, number>(), regions = new Map<string, number>();
  for (const row of rows) {
    for (const [counts, key] of [[digits, digitsKey(row)], [letters, lettersKey(row)], [regions, regionKey(row)]] as const) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { digits, letters, regions };
}

// The row being filtered belongs to this catalogue, so count>1 means there
// really is another matching offer. Never scan the whole list for every row.
export function hasSimilarCatalogOffer(row: SimilarityOffer, kind: string, counts: ReturnType<typeof buildSimilarityCounts>) {
  if (kind === 'similarDigits') return (counts.digits.get(digitsKey(row)) ?? 0) > 1;
  if (kind === 'similarLetters') return (counts.letters.get(lettersKey(row)) ?? 0) > 1;
  return (counts.regions.get(regionKey(row)) ?? 0) > 1;
}

// Connected components of the same relation as the old pairwise graph:
// same seller/vehicle; identical plate with distinct known regions, or one
// different character. A wildcard bucket joins only DIFFERENT plate cores.
export function buildSeriesGroups(input: readonly SeriesOffer[]): Map<string, Group> {
  const seen = new Set<string>();
  const rows = input.filter(row => { if (seen.has(row.id)) return false; seen.add(row.id); return true; });
  const parent = rows.map((_, index) => index), rank = rows.map(() => 0);
  const find = (index: number): number => { while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; } return index; };
  const join = (first: number, second: number) => {
    let a = find(first), b = find(second);
    if (a === b) return;
    if (rank[a] < rank[b]) [a, b] = [b, a];
    parent[b] = a;
    if (rank[a] === rank[b]) rank[a]++;
  };
  const cores = new Map<string, { indices: number[]; regions: Set<string> }>();
  const masks = new Map<string, { core: string; mixed: boolean; indices: number[] }>();
  rows.forEach((row, index) => {
    const prefix = JSON.stringify([row.vehicle, row.seller.trim().toLocaleLowerCase('ru-RU')]);
    const core = `${row.leftLetter}${row.digits}${row.rightLetters}`;
    const region = row.region.split(' · ')[1]?.trim() ?? '';
    if (region) {
      const key = `${prefix}\0${core}`;
      const bucket = cores.get(key) ?? { indices: [], regions: new Set<string>() };
      bucket.indices.push(index); bucket.regions.add(region); cores.set(key, bucket);
    }
    for (let position = 0; position < core.length; position++) {
      const key = `${prefix}\0${position}\0${core.slice(0, position)}\0${core.slice(position + 1)}`;
      const bucket = masks.get(key) ?? { core, mixed: false, indices: [] };
      if (bucket.core !== core) bucket.mixed = true;
      bucket.indices.push(index); masks.set(key, bucket);
    }
  });
  for (const bucket of cores.values()) if (bucket.regions.size > 1) for (const index of bucket.indices) join(bucket.indices[0], index);
  for (const bucket of masks.values()) if (bucket.mixed) for (const index of bucket.indices) join(bucket.indices[0], index);
  const components = new Map<number, Group>();
  rows.forEach((row, index) => {
    const root = find(index), component = components.get(root) ?? { key: row.id, size: 0 };
    if (row.id < component.key) component.key = row.id;
    component.size++; components.set(root, component);
  });
  const result = new Map<string, Group>();
  rows.forEach((row, index) => { const group = components.get(find(index))!; if (group.size > 1) result.set(row.id, group); });
  return result;
}
