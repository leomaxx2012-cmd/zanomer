import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { clearReloadedPlateSearch } from '../lib/catalog-reload.ts';

// Exercise the actual serialized bootstrap, not a separate test implementation.
const script = `(${clearReloadedPlateSearch.toString()})();`;
const query = '?vehicle=car&left=O&digits=00&right=XY&area=Московская%20область&codes=50%2C90&price=300000&features=mirror&listing=offer-1&kind=partner#search';
function browser(path = '/', type = 'reload') {
  const calls = [];
  const state = { route: 'expo-router', key: 'retain-history-state' };
  const window = {
    location: { href: `https://zanomerom.ru${path}${query}` },
    performance: { getEntriesByType: () => [{ type }] },
    history: { state, replaceState: (...args) => calls.push(args) },
  };
  vm.runInNewContext(script, { window, URL });
  return { window, calls, state };
}

test('reload clears the screenshot plate while preserving region, filters and listing link', () => {
  const { calls, state } = browser();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], state);
  const result = new URL(calls[0][2], 'https://zanomerom.ru');
  for (const key of ['left', 'digits', 'right']) assert.equal(result.searchParams.has(key), false);
  for (const key of ['vehicle', 'area', 'codes', 'price', 'features', 'listing', 'kind']) {
    assert.equal(result.searchParams.get(key), new URL(`https://zanomerom.ru/${query}`).searchParams.get(key));
  }
  assert.equal(result.hash, '#search');
});

test('all catalogue entry paths clear letters and digits on reload', () => {
  for (const path of ['/', '/index.html', '/catalog', '/catalog/', '/catalog.html']) {
    const { calls } = browser(path);
    assert.equal(calls.length, 1, path);
    assert.equal(new URL(calls[0][2], 'https://zanomerom.ru').pathname, path);
  }
});

test('opening shared links and browser back/forward keep the requested plate', () => {
  for (const type of ['navigate', 'back_forward']) assert.equal(browser('/', type).calls.length, 0);
});

test('unrelated routes and already empty searches are left alone', () => {
  assert.equal(browser('/privacy').calls.length, 0);
  const { window, calls } = browser('/', 'navigate');
  window.performance.getEntriesByType = () => [{ type: 'reload' }];
  window.location.href = 'https://zanomerom.ru/?region=moskva&vehicle=car';
  vm.runInNewContext(script, { window, URL });
  assert.equal(calls.length, 0);
});

test('repeated and partial plate parameters are removed completely', () => {
  const { window, calls } = browser('/', 'navigate');
  window.performance.getEntriesByType = () => [{ type: 'reload' }];
  window.location.href = 'https://zanomerom.ru/?left=O&left=A&digits=00&region=moskva';
  vm.runInNewContext(script, { window, URL });
  assert.equal(calls[0][2], '/?region=moskva');
});

test('missing browser APIs or denied history writes cannot stop startup', () => {
  for (const window of [undefined, {}, { performance: { getEntriesByType: () => [] } }]) {
    assert.doesNotThrow(() => vm.runInNewContext(script, { window, URL }));
  }
  const { window } = browser('/', 'navigate');
  window.performance.getEntriesByType = () => [{ type: 'reload' }];
  window.history.replaceState = () => { throw new Error('denied'); };
  assert.doesNotThrow(() => vm.runInNewContext(script, { window, URL }));
});
