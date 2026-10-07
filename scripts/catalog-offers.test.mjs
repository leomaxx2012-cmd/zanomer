import test from 'node:test';
import assert from 'node:assert/strict';
import { deduplicateOffers } from '../lib/catalog-offers.ts';
const offer = {id:'1',vehicle:'car',leftLetter:'А',digits:'111',rightLetters:'АА',region:'Москва · 77',priceValue:100000,sourceUrl:'https://t.me/runomer/1',createdAt:'2026-10-07'};
test('different posts with different prices stay visible', () => assert.equal(deduplicateOffers([offer,{...offer,id:'2',sourceUrl:'https://t.me/runomer/2',priceValue:120000}]).length,2));
test('same post replaces cached old price', () => {
  const result = deduplicateOffers([offer,{...offer,priceValue:120000}]);
  assert.equal(result.length,1); assert.equal(result[0].priceValue,120000);
});
test('identical price offers collapse across alphabets and region labels', () => assert.equal(deduplicateOffers([offer,{...offer,id:'2',sourceUrl:'https://vk.ru/wall1_2',leftLetter:'A',rightLetters:'AA',region:'77'}]).length,1));
