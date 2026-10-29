import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAvailability, inspectTelegramPost, selectSavedPosts, createTelegramReader, recheckSavedPosts } from './partner-availability.mjs';
import { CatalogIndex } from './catalog-identity.mjs';

const sources = [{ handle: 'runomer' }, { handle: 'specznak' }];
const base = { id: 'one', table: 'partner_listings', source_url: 'https://t.me/runomer/123', status: 'active', archive_reason: null, checked_at: '2026-10-01T00:00:00Z', vehicle_type: 'car', plate_left: 'А', plate_digits: '001', plate_right: 'АА', region: '77', price_rub: 100000 };
const widget = (text, id = 'runomer/123') => `<div class="tgme_widget_message text_not_supported_wrap" data-post="${id}"><div class="tgme_widget_message_text js-message_text">${text}</div></div>`;
const missing = '<div class="tgme_widget_message_error">Post not found</div>';

test('Russian sold/reserved markers work with punctuation and letter boundaries', () => {
  for (const text of ['Продано!', 'НОМЕР ПРОДАН', '#продано', 'Забронирован.', 'В резерве', 'Снято с продажи', 'Нет в наличии']) assert.equal(classifyAvailability(text), 'sold', text);
  for (const text of ['Продам номер', 'Номер не продан', 'НЕ ЗАБРОНИРОВАН', 'Распроданный', 'непродано']) assert.equal(classifyAvailability(text), 'active', text);
});
test('a partial sale or contradictory caption cannot archive a multi-offer post', () => {
  assert.equal(classifyAvailability('А001АА77 продано, А002АА77 100000', 2), 'unknown');
  assert.equal(classifyAvailability('Все номера проданы!', 2), 'sold');
  assert.equal(classifyAvailability('Все номера проданы, кроме А002АА77', 2), 'unknown');
  assert.equal(classifyAvailability('Продано, но снова в продаже'), 'unknown');
  assert.equal(classifyAvailability('Если номер продан, пост удаляется'), 'unknown');
  assert.equal(classifyAvailability('Пометка «продано» появится позже'), 'unknown');
});
test('only the requested public widget or explicit Telegram missing-post error is evidence', () => {
  const inspect = (html, status = 200) => inspectTelegramPost({ html, status, handle: 'runomer', postId: '123' });
  assert.equal(inspect(widget('Продано')).state, 'sold');
  assert.equal(inspect(widget('А001АА77 цена 100000')).state, 'active');
  assert.equal(inspect(missing).state, 'missing');
  for (const html of [widget('Продано', 'runomer/999'), '<h1>Post not found</h1>', '<div class="tgme_widget_message_error">This channel is private</div>', '<html>Sign in</html>']) assert.equal(inspect(html).state, 'unknown');
  for (const status of [403, 404, 429, 500, 503]) assert.equal(inspect(missing, status).state, 'unknown');
});
test('old posts are grouped and selected first; manual archives and other sources stay untouched', () => {
  const rows = [base, { ...base, id: 'two' }, { ...base, id: 'new', source_url: 'https://t.me/specznak/7', checked_at: '2026-10-20T00:00:00Z' }, { ...base, id: 'manual', source_url: 'https://t.me/runomer/9', status: 'archived', archive_reason: 'Скрыто владельцем' }, { ...base, id: 'other', source_url: 'https://t.me/unapproved/1' }, { ...base, id: 'own', table: 'auto_listings' }];
  const selected = selectSavedPosts(rows, sources, 1);
  assert.equal(selected.length, 1); assert.equal(selected[0].rows.length, 2); assert.equal(selected[0].sourceUrl, base.source_url);
  assert.equal(selectSavedPosts(rows, sources, 40).length, 2);
});

function fakeDb() {
  const updates = [], statuses = [];
  return { updates, statuses, from(table) { return {
    update(patch) { return { async in(column, ids) { assert.equal(table, 'partner_listings'); updates.push({ patch, column, ids }); return { error: null }; } }; },
    async upsert(row) { assert.equal(table, 'partner_listing_statuses'); statuses.push(row); return { error: null }; },
  }; } };
}
test('confirmed missing/sold posts archive real rows, preserve prices and record reason/date', async () => {
  for (const html of [missing, widget('Продано')]) {
    const db = fakeDb(), catalogIndex = new CatalogIndex([base]);
    const result = await recheckSavedPosts({ db, catalogIndex, sources, readTelegram: async () => ({ status: 200, ok: true, text: async () => html }), now: () => '2026-10-29T10:00:00Z' });
    assert.equal(result.archived, 1); assert.equal(catalogIndex.rows[0].status, 'archived');
    assert.equal(catalogIndex.rows[0].price_rub, 100000); assert.match(db.updates[0].patch.archive_reason, /^Telegram:/);
    assert.equal(db.updates[0].patch.checked_at, '2026-10-29T10:00:00Z'); assert.deepEqual(db.updates[0].ids, ['one']);
    assert.equal(db.statuses[0].source_url, base.source_url);
  }
});
test('a reappearing old post restores an automatic archive without importing a new row', async () => {
  const db = fakeDb(), catalogIndex = new CatalogIndex([{ ...base, status: 'archived', archive_reason: 'Telegram: исходный пост удалён' }]);
  const result = await recheckSavedPosts({ db, catalogIndex, sources, readTelegram: async () => ({ status: 200, ok: true, text: async () => widget('А001АА77 цена 100000') }) });
  assert.equal(result.restored, 1); assert.equal(catalogIndex.rows.length, 1); assert.equal(catalogIndex.rows[0].status, 'active'); assert.equal(catalogIndex.rows[0].archive_reason, null);
});
test('network errors and ambiguous posts preserve status; attempt dates rotate the next batch', async () => {
  const db = fakeDb(), later = { ...base, id: 'later', source_url: 'https://t.me/specznak/4', checked_at: '2026-10-02T00:00:00Z' };
  const catalogIndex = new CatalogIndex([base, later]);
  const result = await recheckSavedPosts({ db, catalogIndex, sources, limit: 1, readTelegram: async () => { throw Error('timeout'); }, now: () => '2026-10-29T10:00:00Z' });
  assert.equal(result.unknown, 1); assert.equal(result.archived, 0); assert.equal(catalogIndex.rows.find(r => r.id === base.id).status, 'active');
  assert.deepEqual(db.updates[0].patch, { checked_at: '2026-10-29T10:00:00Z' }); assert.equal(db.statuses.length, 0);
  assert.equal(selectSavedPosts(catalogIndex.rows, sources, 1)[0].sourceUrl, later.source_url);
});
test('database status-write failures are reported and cannot be counted as a successful archive', async () => {
  const db = fakeDb(); db.from = () => ({ update: () => ({ in: async () => ({ error: { message: 'write denied' } }) }) });
  const result = await recheckSavedPosts({ db, catalogIndex: new CatalogIndex([base]), sources, readTelegram: async () => ({ status: 200, ok: true, text: async () => missing }) });
  assert.equal(result.archived, 0); assert.equal(result.errors.length, 1);
});
test('one shared limiter waits 8 seconds across feeds, saved posts and source changes', async () => {
  let clock = 1000; const starts = [];
  const read = createTelegramReader({ sources, now: () => clock, sleep: async ms => { clock += ms; }, fetchImpl: async (url, options) => { starts.push(clock); assert.equal(options.redirect, 'error'); return { status: 200 }; } });
  await read('https://t.me/s/runomer'); await read('https://t.me/runomer/123?embed=1&mode=tme'); await read('https://t.me/s/specznak');
  assert.deepEqual(starts, [1000, 9000, 17000]);
  for (const url of ['http://t.me/runomer/123', 'https://t.me/unapproved/1', 'https://example.com/runomer/1', 'https://t.me@evil.test/runomer/1']) await assert.rejects(read(url));
  assert.equal(starts.length, 3);
});
