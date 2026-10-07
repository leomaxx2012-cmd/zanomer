import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogIndex, offerIdentity } from './catalog-identity.mjs';
const row = { id:'old', table:'partner_listings', plate_left:'A', plate_digits:'111', plate_right:'AA', region:'Москва · 77', vehicle_type:'car', price_rub:100000, source_url:'https://t.me/runomer/1', status:'active' };
test('same normalized plate, region, vehicle and price is duplicate', () => {
  assert.equal(offerIdentity(row), offerIdentity({...row,plate_left:'А',plate_right:'АА',region:'77',price_rub:'100000'}));
  assert.ok(new CatalogIndex([row]).duplicate({...row,id:'other',source_url:'https://vk.ru/wall1_1'}));
});
test('different prices are separate offers', () => assert.equal(new CatalogIndex([row]).duplicate({...row,price_rub:120000}),false));
test('same post updates existing identity even when price changes', () => assert.equal(new CatalogIndex([row]).sameSource({...row,id:'new',plate_left:'А',plate_right:'АА',price_rub:120000})?.id,'old'));
test('region and vehicle remain separate', () => {
  assert.equal(new CatalogIndex([row]).duplicate({...row,region:'177'}),false);
  assert.equal(new CatalogIndex([row]).duplicate({...row,vehicle_type:'truck'}),false);
});
test('newly imported offers participate in duplicate checks', () => {
  const index = new CatalogIndex(); index.remember(row);
  assert.ok(index.duplicate(row));
  index.remember({...row,price_rub:120000});
  assert.equal(index.duplicate(row),false);
});
