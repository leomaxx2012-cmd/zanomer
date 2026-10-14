import test from 'node:test';
import assert from 'node:assert/strict';
import { loadVkApiPosts } from './vk-api-source.mjs';

test('makes one POST only for the permitted community, keeping token out of URL', async () => {
  let calls = 0;
  const posts = await loadVkApiPosts('test-secret', undefined, async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.vk.com/method/wall.get');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.body.get('domain'), 'aautonomera777');
    assert.equal(options.body.get('access_token'), 'test-secret');
    return Response.json({ response: { items: [{ owner_id: -123, id: 4, date: 1791972000, text: 'А777АА77 цена 100000' }] } });
  });
  assert.equal(calls, 1);
  assert.equal(posts[0].postId, '-123_4');
  assert.equal(posts[0].sold, false);
});

test('API errors expose only error code, without echoing request credentials', async () => {
  await assert.rejects(loadVkApiPosts('secret', undefined, async () => Response.json({ error: { error_code: 5, request_params: [{ value: 'secret' }] } })), error => error.message === 'VK_API_ERROR: code 5');
});

test('does not retry or follow redirects', async () => {
  let calls = 0;
  await assert.rejects(loadVkApiPosts('secret', undefined, async () => { calls++; return new Response('', { status: 302 }); }), /VK_API_HTTP_ERROR/);
  assert.equal(calls, 1);
});

test('ignores incomplete and deleted posts; recognizes sold Cyrillic text', async () => {
  const posts = await loadVkApiPosts('secret', undefined, async () => Response.json({ response: { items: [
    { owner_id: -123, id: 1, date: 1791972000, text: 'Номер продан.' },
    { owner_id: -123, id: 2, date: 1791972000, text: 'Цена', is_deleted: 1 },
    { owner_id: -123, id: 3, text: 'Без даты' },
  ] } }));
  assert.equal(posts.length, 1);
  assert.equal(posts[0].sold, true);
});
