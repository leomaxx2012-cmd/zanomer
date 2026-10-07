import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleCompared, comparisonPrices } from '../lib/listing-comparison.ts';
const rows = Array.from({length:5}, (_,i) => ({id:String(i),priceValue:(i+1)*100}));
test('at most four distinct offers; removing selected item frees a slot', () => {
  let selected=[];
  for (const row of rows) selected=toggleCompared(selected,row);
  assert.equal(selected.length,4);
  selected=toggleCompared(selected,rows[1]);
  selected=toggleCompared(selected,rows[4]);
  assert.deepEqual(selected.map(item=>item.id),['0','2','3','4']);
});
test('comparison uses latest price, not stale selected snapshot', () => {
  const results=comparisonPrices(rows.slice(0,2),[{...rows[0],priceValue:300},rows[1]]);
  assert.deepEqual(results.map(item=>item.difference),[100,0]);
});
test('equal cheapest prices both get zero; missing catalog row uses snapshot', () => {
  assert.deepEqual(comparisonPrices([{id:'a',priceValue:100},{id:'b',priceValue:100}],[]).map(item=>item.difference),[0,0]);
  assert.deepEqual(comparisonPrices([],[]),[]);
});
