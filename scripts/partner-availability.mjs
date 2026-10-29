// Public Telegram evidence only. A transport failure is never proof that an
// offer was deleted. No source text or contact information is persisted.
const SOLD = /(?<![\p{L}\p{N}_])(?:продан[аоы]?|продали|забронирован[аоы]?|зарезервирован[аоы]?|в\s+резерве|снят[аоы]?\s+с\s+продажи|нет\s+в\s+наличии)(?![\p{L}\p{N}_])/giu;
const AUTOMATIC_REASON = /^(?:Telegram:|В исходном посте указано, что номер продан или забронирован)/u;
export const isAutomaticallyArchived = row => row.status === 'archived' && AUTOMATIC_REASON.test(row.archive_reason ?? '');
const plainText = value => value.replace(/<br\s*\/?>/giu, '\n').replace(/<[^>]*>/gu, ' ')
  .replace(/&nbsp;/giu, ' ').replace(/&amp;/giu, '&').replace(/&quot;/giu, '"')
  .replace(/&#39;/gu, "'").replace(/\s+/gu, ' ').trim();

export function classifyAvailability(text, offerCount = 1) {
  const markers = [...text.matchAll(SOLD)].filter(match =>
    !/(?<!\p{L})не\s*$/iu.test(text.slice(0, match.index)));
  if (!markers.length) return 'active';
  if (markers.some(match => /(?:(?:если|когда)[^.!?\n]{0,60}|(?:пометка|слово|пример)\s*[«"']?\s*)$/iu.test(text.slice(0, match.index)))) return 'unknown';
  if (markers.some(match => /^\s*\?/u.test(text.slice(match.index + match[0].length)))) return 'unknown';
  if (/(?:номер(?:а)?\s+(?:(?:ещ[её]|снова)\s+)?(?:в\s+продаже|доступ(?:ен|ны))|(?:машина|автомобиль|авто)\s+продан[ао]?)/iu.test(text)) return 'unknown';
  if (/(?:кроме|не\s+вс[её]|часть\s+номеров|некоторые\s+номера|ещ[её]\s+доступ|остал(?:ись|ся)|снова\s+в\s+продаже)/iu.test(text)) return 'unknown';
  // A sale marker next to one plate must not hide other offers from the same
  // multi-offer post. Only an unambiguous whole-post marker is sufficient.
  if (offerCount > 1 && !/(?:все\s+(?:номера|позиции)\s+проданы|весь\s+список\s+продан|объявление\s+снято\s+с\s+продажи)/iu.test(text)) return 'unknown';
  return 'sold';
}

export function inspectTelegramPost({ status, html, handle, postId, offerCount = 1 }) {
  if (status !== 200) return { state: 'unknown', reason: `HTTP ${status}` };
  const error = html.match(/class=["'][^"']*\btgme_widget_message_error\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/iu)?.[1];
  if (error && /^(?:post not found\.?|message (?:not found|does(?:n['’]t| not) exist)\.?|публикация не найдена\.?|сообщение (?:не найдено|удалено)\.?)$/iu.test(plainText(error))) {
    return { state: 'missing', reason: 'Telegram: исходный пост удалён или недоступен (Post not found)' };
  }
  // A login page, private-channel notice, generic error or wrong post is not
  // evidence about this offer, even when Telegram returns HTTP 200.
  const escapedHandle = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = html.match(new RegExp(`<div class=["'][^"']*\\btgme_widget_message\\b[^"']*["'][^>]*data-post=["']${escapedHandle}/${postId}["'][\\s\\S]*?(?=<div class=["']tgme_widget_message\\b|<div class=["']tgme_widget_message_wrap|$)`, 'iu'))?.[0];
  if (!block) return { state: 'unknown', reason: 'Expected public post not found in response' };
  const content = block.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/iu)?.[1];
  if (content === undefined && !/tgme_widget_message_(?:photo|video|document)/u.test(block)) return { state: 'unknown', reason: 'Post content could not be read' };
  const state = classifyAvailability(plainText(content ?? ''), offerCount);
  return { state, reason: state === 'sold' ? 'Telegram: в исходном посте указано, что номер продан или забронирован' : null };
}

export function selectSavedPosts(rows, sources, limit = 40) {
  const allowed = new Set(sources.map(source => source.handle));
  const grouped = new Map();
  for (const row of rows) {
    if (row.table !== 'partner_listings') continue;
    if (row.status !== 'active' && !isAutomaticallyArchived(row)) continue;
    const match = row.source_url?.match(/^https:\/\/t\.me\/([a-zA-Z0-9_]+)\/(\d+)$/u);
    if (!match || !allowed.has(match[1])) continue;
    const entry = grouped.get(row.source_url) ?? { sourceUrl: row.source_url, handle: match[1], postId: match[2], rows: [], checkedAt: Infinity };
    entry.rows.push(row);
    entry.checkedAt = Math.min(entry.checkedAt, Date.parse(row.checked_at ?? '') || 0);
    grouped.set(row.source_url, entry);
  }
  return [...grouped.values()].sort((a, b) => a.checkedAt - b.checkedAt || a.sourceUrl.localeCompare(b.sourceUrl)).slice(0, limit);
}

export function createTelegramReader({ sources, fetchImpl = fetch, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const allowed = new Set(sources.map(source => source.handle));
  let lastStartedAt = null;
  return async function readTelegram(address) {
    const url = new URL(address);
    const match = url.pathname.match(/^\/s\/([a-zA-Z0-9_]+)$/u) ?? url.pathname.match(/^\/([a-zA-Z0-9_]+)\/\d+$/u);
    if (url.protocol !== 'https:' || url.hostname !== 't.me' || url.username || url.password || url.port || !match || !allowed.has(match[1])) throw new Error('Not an allowed public Telegram source');
    if (lastStartedAt !== null) await sleep(Math.max(0, 8_000 - (now() - lastStartedAt)));
    lastStartedAt = now();
    return fetchImpl(url.href, { redirect: 'error', signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'ZaNomer catalog checker/1.0', 'cache-control': 'no-cache' } });
  };
}

export async function applyPostEvidence({ db, catalogIndex, post, evidence, checkedAt }) {
  const status = evidence.state === 'sold' || evidence.state === 'missing' ? 'archived' : 'active';
  const patch = evidence.state === 'unknown' ? { checked_at: checkedAt } : {
    status, archive_reason: status === 'archived' ? evidence.reason : null,
    checked_at: checkedAt, updated_at: checkedAt,
  };
  if (!post.rows.length) return { archived: 0, restored: 0 };
  const { error } = await db.from('partner_listings').update(patch).in('id', post.rows.map(row => row.id));
  if (error) throw error;
  if (evidence.state !== 'unknown') {
    const { error: statusError } = await db.from('partner_listing_statuses').upsert({ source_url: post.sourceUrl, ...patch });
    if (statusError) throw statusError;
  }
  const archived = evidence.state === 'unknown' ? 0 : post.rows.filter(row => row.status !== 'archived' && status === 'archived').length;
  const restored = evidence.state === 'unknown' ? 0 : post.rows.filter(row => row.status === 'archived' && status === 'active').length;
  for (const row of post.rows) catalogIndex.remember({ ...row, ...patch });
  return { archived, restored };
}

export async function recheckSavedPosts({ db, catalogIndex, sources, readTelegram, limit = 40, now = () => new Date().toISOString() }) {
  const result = { checkedPosts: 0, archived: 0, restored: 0, unknown: 0, errors: [] };
  for (const post of selectSavedPosts(catalogIndex.rows, sources, limit)) {
    const checkedAt = now();
    let evidence;
    try {
      const response = await readTelegram(`https://t.me/${post.handle}/${post.postId}?embed=1&mode=tme`);
      const identities = new Set(post.rows.map(row => `${row.vehicle_type}|${row.plate_left}|${row.plate_digits}|${row.plate_right}|${row.region}`));
      evidence = inspectTelegramPost({ status: response.status, html: response.ok ? await response.text() : '', handle: post.handle, postId: post.postId, offerCount: identities.size });
    } catch (error) {
      evidence = { state: 'unknown', reason: error.message };
    }
    try {
      const changes = await applyPostEvidence({ db, catalogIndex, post, evidence, checkedAt });
      result.checkedPosts++;
      result.archived += changes.archived;
      result.restored += changes.restored;
      if (evidence.state === 'unknown') {
        result.unknown++;
        result.errors.push({ sourceUrl: post.sourceUrl, reason: evidence.reason ?? 'Ambiguous availability' });
      }
    } catch (error) {
      result.errors.push({ sourceUrl: post.sourceUrl, reason: error.message });
    }
  }
  return result;
}
