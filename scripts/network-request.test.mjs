import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimeoutFetch } from '../lib/network-request.ts';

test('aborts stalled transport so a later login can proceed', async () => {
  let cancelled = false;
  const transport = async (_url, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => { cancelled = true; reject(new Error('aborted')); });
  });
  await assert.rejects(createTimeoutFetch(transport, 10)('https://example.test'), /aborted/);
  assert.equal(cancelled, true);
});

test('preserves response and does not abort completed request later', async () => {
  let signal;
  const response = new Response('ok');
  const transport = async (_url, options) => { signal = options.signal; return response; };
  assert.equal(await createTimeoutFetch(transport, 10)('https://example.test'), response);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(signal.aborted, false);
});

test('preserves caller cancellation', async () => {
  const caller = new AbortController();
  const transport = async (_url, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('cancelled')));
    caller.abort();
  });
  await assert.rejects(createTimeoutFetch(transport, 100)('https://example.test', { signal: caller.signal }), /cancelled/);
});
