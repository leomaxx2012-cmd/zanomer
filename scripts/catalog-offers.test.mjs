import test from 'node:test';
import assert from 'node:assert/strict';
import { deduplicateOffers, mergeCatalogOffers } from '../lib/catalog-offers.ts';
const offer = {id:'1',vehicle:'car',leftLetter:'А',digits:'111',rightLetters:'АА',region:'Москва · 77',priceValue:100000,sourceUrl:'https://t.me/runomer/1',createdAt:'2026-10-07'};
test('different posts with different prices stay visible', () => assert.equal(deduplicateOffers([offer,{...offer,id:'2',sourceUrl:'https://t.me/runomer/2',priceValue:120000}]).length,2));
test('same post replaces cached old price', () => {
  const result = deduplicateOffers([offer,{...offer,priceValue:120000}]);
  assert.equal(result.length,1); assert.equal(result[0].priceValue,120000);
});
test('identical price offers collapse across alphabets and region labels', () => assert.equal(deduplicateOffers([offer,{...offer,id:'2',sourceUrl:'https://vk.ru/wall1_2',leftLetter:'A',rightLetters:'AA',region:'77'}]).length,1));

test('partial or empty network response cannot roll back the newest cached listing', () => {
  const newest = {...offer, id:'new', sourceUrl:'https://t.me/runomer/99', digits:'999', createdAt:'2026-10-20'};
  const saved = mergeCatalogOffers([offer], [newest]);
  assert.equal(mergeCatalogOffers(saved, [offer])[0].id, 'new');
  assert.deepEqual(mergeCatalogOffers(saved, []), saved);
});

test('cached price and later live price replace bundled value for the same post', () => {
  const saved = mergeCatalogOffers([offer], [{...offer, priceValue:120000}]);
  assert.equal(saved[0].priceValue,120000);
  const live = mergeCatalogOffers(saved, [{...offer, priceValue:90000}]);
  assert.equal(live.length,1);
  assert.equal(live[0].priceValue,90000);
});

test('successive pages survive when a subsequent page fails', () => {
  let current = [offer];
  for (let page = 0; page < 3; page++) {
    current = mergeCatalogOffers(current, [{...offer,id:`page-${page}`,sourceUrl:`https://t.me/runomer/${page + 10}`,digits:`${page}22`,createdAt:'2026-10-20'}]);
  }
  assert.equal(current.length,4);
  assert.equal(mergeCatalogOffers(current, []).length,4);
});

test('unchanged background pages preserve catalogue identity', () => {
  const current = [offer];
  assert.equal(mergeCatalogOffers(current, [{...offer}]), current);
  assert.equal(mergeCatalogOffers(current, []), current);
});

test('real metadata and price changes publish without rebuilding unchanged records', () => {
  const other = {...offer,id:'2',digits:'222',sourceUrl:'https://t.me/runomer/2'};
  const current = deduplicateOffers([offer,other]);
  const result = mergeCatalogOffers(current, [{...offer,priceValue:120000,tag:'Новая цена'}]);
  assert.notEqual(result,current);
  assert.equal(result.find(row => row.id === '1').priceValue,120000);
  assert.equal(result.find(row => row.id === '1').tag,'Новая цена');
  assert.equal(result.find(row => row.id === '2'),other);
});
