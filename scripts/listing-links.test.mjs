import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listingLink, sharedListingId, sharedListingTable } from '../lib/listing-links.ts';

test('partner shares stay on our domain and preserve the exact listing ID', () => {
  const id = 'runomer-71808-е242еу550';
  const url = new URL(listingLink(id));
  assert.equal(url.origin, 'https://zanomerom.ru');
  assert.equal(url.pathname, '/');
  assert.equal(sharedListingId(url.searchParams.get('listing')), id);
  assert.equal(sharedListingTable(id, url.searchParams.get('kind')), 'partner_listings');
});

test('site and explicit app links resolve to the same offer', () => {
  const id = '12345678-1234-4567-89ab-123456789abc';
  for (const native of [false, true]) {
    const url = new URL(listingLink(id, true, native));
    assert.equal(url.protocol, native ? 'avtonomer:' : 'https:');
    assert.equal(url.searchParams.get('listing'), id);
    assert.equal(sharedListingTable(id, url.searchParams.get('kind')), 'auto_listings');
  }
  assert.equal(sharedListingTable(id, undefined), 'auto_listings');
});

test('query parameters cannot become arbitrary URLs or database filters', () => {
  for (const id of ['', '../path', 'https://t.me/test', 'x,y', 'a'.repeat(241), null, {}]) {
    assert.equal(sharedListingId(id), null);
  }
  assert.equal(sharedListingId(['runomer-123', 'ignored']), 'runomer-123');
});

test('HTTPS links match the verified Android intent and website association', () => {
  const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url)));
  const links = JSON.parse(readFileSync(new URL('../public/.well-known/assetlinks.json', import.meta.url)));
  const url = new URL(listingLink('runomer-123'));
  assert.ok(config.expo.android.intentFilters.some(filter => filter.autoVerify
    && filter.action === 'VIEW' && filter.category.includes('BROWSABLE')
    && filter.data.some(data => data.scheme === 'https' && data.host === url.hostname && data.path === url.pathname)));
  assert.ok(links.some(link => link.target.package_name === config.expo.android.package
    && link.relation.includes('delegate_permission/common.handle_all_urls')
    && link.target.sha256_cert_fingerprints.every(value => /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value))));
});
