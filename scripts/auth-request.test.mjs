import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForAuth } from '../lib/auth-request.ts';

test('returns successful response', async () => {
  assert.equal(await waitForAuth(Promise.resolve('ok'), 100), 'ok');
});
test('preserves server error', async () => {
  const error = new Error('server failed');
  await assert.rejects(waitForAuth(Promise.reject(error), 100), error);
});
test('releases waiting UI on timeout', async () => {
  await assert.rejects(waitForAuth(new Promise(() => {}), 10), /не ответил вовремя/);
});
test('late failure after timeout is handled', async () => {
  const request = new Promise((_, reject) => setTimeout(() => reject(new Error('late')), 30));
  await assert.rejects(waitForAuth(request, 5), /не ответил вовремя/);
  await new Promise(resolve => setTimeout(resolve, 40));
});
