export type CatalogWorkOptions = {
  isActive?: () => boolean;
  now?: () => number;
  yieldNow?: () => Promise<void>;
  budgetMs?: number;
  maxBatchSize?: number;
};

// Delaying a large callback with InteractionManager does not split its work.
// Give native touch/scroll events a turn between short catalogue slices.
export async function forEachCatalogChunk<T>(rows: readonly T[], visit: (row: T, index: number) => void, options: CatalogWorkOptions = {}) {
  const active = options.isActive ?? (() => true);
  const now = options.now ?? Date.now;
  const yieldNow = options.yieldNow ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  const budget = Math.max(1, options.budgetMs ?? 6);
  const batchSize = Math.max(1, options.maxBatchSize ?? 64);
  let startedAt = now(), processed = 0;
  if (!active()) return false;
  for (let index = 0; index < rows.length; index++) {
    visit(rows[index], index);
    processed++;
    if (index + 1 < rows.length && (processed >= batchSize || now() - startedAt >= budget)) {
      await yieldNow();
      if (!active()) return false;
      startedAt = now(); processed = 0;
    }
  }
  return active();
}
export async function mapCatalogChunks<T, U>(rows: readonly T[], map: (row: T, index: number) => U, options: CatalogWorkOptions = {}): Promise<U[] | null> {
  const result: U[] = [];
  return await forEachCatalogChunk(rows, (row, index) => { result.push(map(row, index)); }, options) ? result : null;
}
export async function serializeCatalogChunks<T>(rows: readonly T[], options: CatalogWorkOptions = {}): Promise<string | null> {
  const parts = await mapCatalogChunks(rows, row => JSON.stringify(row) ?? 'null', options);
  return parts ? `[${parts.join(',')}]` : null;
}
type Offer = { id: string; vehicle: string; leftLetter: string; digits: string; rightLetters: string; region: string; priceValue: number; sourceUrl?: string; createdAt: string; publishedAt?: string };
const letters: Record<string, string> = { A:'А', B:'В', C:'С', E:'Е', H:'Н', K:'К', M:'М', O:'О', P:'Р', T:'Т', X:'Х', Y:'У', V:'В' };
const plateKeys = new WeakMap<Offer, string>();
function plateKey(row: Offer) {
  const cached = plateKeys.get(row);
  if (cached !== undefined) return cached;
  const plate = `${row.leftLetter}${row.digits}${row.rightLetters}`.toUpperCase().replace(/[ABCEHKMOPTXYV]/g, c => letters[c]).replace(/[^А-Я0-9]/g, '');
  const region = row.region.trim().match(/\d{1,3}$/)?.[0]?.replace(/^0+(?=\d)/, '') ?? row.region.trim();
  const key = `${row.vehicle}|${plate}|${region}`;
  plateKeys.set(row, key);
  return key;
}
const newestFirst = (a: Offer, b: Offer) => { const first = a.publishedAt ?? a.createdAt, second = b.publishedAt ?? b.createdAt; return first === second ? 0 : first < second ? 1 : -1; };
function sameFields<T extends Offer>(first: T, second: T) {
  const keys = Object.keys(first) as (keyof T)[];
  return keys.length === Object.keys(second).length && keys.every(key => Object.is(first[key], second[key]) || ((String(key) === "saleDetails" || String(key) === "photoUrls") && JSON.stringify(first[key]) === JSON.stringify(second[key])));
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
  return [...offers.values()].sort(newestFirst);
}

// New pages extend the last successful catalogue, never an older bundled copy.
export function mergeCatalogOffers<T extends Offer>(current: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return current;
  const previous = new Map(current.map(row => [row.id, row]));
  if (incoming.every(row => { const old = previous.get(row.id); return old && sameFields(row, old); })) return current;
  const merged = deduplicateOffers([...current, ...incoming]).map(row => {
    const old = previous.get(row.id);
    if (!old) return row;
    return sameFields(row, old) ? old : row;
  });
  // Background page checks often return unchanged records. Preserve identity
  // so React skips rebuilding the catalogue and serializing it to storage.
  return merged.length === current.length && merged.every((row, index) => row === current[index]) ? current : merged;
}

// Preserve merge rules while allowing touch events between catalogue passes.
// null means the screen/effect was disposed or a newer publication superseded
// this one; a partial result is never published or written to offline storage.
export async function mergeCatalogOffersInChunks<T extends Offer>(current: T[], incoming: T[], options: CatalogWorkOptions = {}): Promise<T[] | null> {
  if (!incoming.length) return current;
  const previous = new Map<string, T>();
  if (!await forEachCatalogChunk(current, row => { previous.set(row.id, row); }, options)) return null;
  let changed = false;
  if (!await forEachCatalogChunk(incoming, row => { const old = previous.get(row.id); if (!old || !sameFields(row, old)) changed = true; }, options)) return null;
  if (!changed) return current;
  const sources = new Map<string, T>();
  if (!await forEachCatalogChunk([...current, ...incoming], row => {
    const key = row.sourceUrl ? `${row.sourceUrl}|${plateKey(row)}` : `id:${row.id}`;
    const old = sources.get(key);
    if (!old || (row.publishedAt ?? row.createdAt) >= (old.publishedAt ?? old.createdAt)) sources.set(key, row);
  }, options)) return null;
  const offers = new Map<string, T>();
  if (!await forEachCatalogChunk([...sources.values()], row => {
    const key = `${plateKey(row)}|${Number(row.priceValue)}`, old = offers.get(key);
    if (!old || (row.publishedAt ?? row.createdAt) >= (old.publishedAt ?? old.createdAt)) offers.set(key, row);
  }, options)) return null;
  const merged = [...offers.values()].sort(newestFirst);
  if (!await forEachCatalogChunk(merged, (row, index) => { const old = previous.get(row.id); if (old && sameFields(row, old)) merged[index] = old; }, options)) return null;
  return merged.length === current.length && merged.every((row, index) => row === current[index]) ? current : merged;
}

// Only a complete, successful active-site snapshot can remove cached site offers.
export function retainActiveSiteOffers<T extends {id:string;isSiteListing?:boolean}>(rows:T[],activeIds:ReadonlySet<string>|undefined):T[]{
 if(!activeIds)return rows;const next=rows.filter(row=>!row.isSiteListing||activeIds.has(row.id));return next.length===rows.length?rows:next;
}
