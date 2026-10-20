import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimeoutFetch, createSessionSafeFetch } from '../lib/network-request.ts';

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

const refreshUrl = 'https://example.test/auth/v1/token?grant_type=refresh_token';
test('VPN/captive portal HTML is a transport failure, not a revoked login', async () => {
  for (const status of [200,403,502]) {
    const request = createSessionSafeFetch(async () => new Response('<html>Network unavailable</html>',{status}));
    await assert.rejects(request(refreshUrl), TypeError);
  }
});

test('rate limits and timeouts preserve refresh retry semantics', async () => {
  for (const status of [408,429,503]) {
    await assert.rejects(createSessionSafeFetch(async () => Response.json({message:'temporary'},{status}))(refreshUrl), TypeError);
  }
});

test('genuine revoked refresh token is passed to SDK for sign-out', async () => {
  const response=Response.json({code:'refresh_token_not_found',msg:'Invalid Refresh Token'},{status:400});
  assert.equal(await createSessionSafeFetch(async () => response)(refreshUrl),response);
});

test('valid token refresh remains readable and unrelated requests are untouched', async () => {
  const response=Response.json({access_token:'test-access',refresh_token:'test-refresh'});
  const returned=await createSessionSafeFetch(async () => response)(refreshUrl);
  assert.equal((await returned.json()).access_token,'test-access');
  const denied=new Response('Denied',{status:403});
  assert.equal(await createSessionSafeFetch(async () => denied)('https://example.test/rest/v1/private'),denied);
});
