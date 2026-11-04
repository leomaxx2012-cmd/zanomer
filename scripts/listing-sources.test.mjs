import test from 'node:test';
import assert from 'node:assert/strict';
import { listingSource, matchesListingSources, availableListingSources } from '../lib/listing-sources.ts';

const spec = { vehicle:'car', sourceUrl:'https://t.me/specznak/13765' };
const runomer = { vehicle:'car', sourceUrl:'https://t.me/runomer/73217' };

test('channel identity uses the URL, not the display name or similar handle', () => {
  assert.equal(listingSource({...spec, sourceUrl:'https://t.me/SPECZNAK/1'}).id, 'telegram:specznak');
  assert.equal(listingSource({...spec, sourceUrl:'https://t.me/s/specznak/1'}).id, 'telegram:specznak');
  assert.equal(matchesListingSources({...spec, sourceUrl:'https://t.me/specznak777/1'}, ['telegram:specznak']), false);
  assert.equal(matchesListingSources({...spec, sourceUrl:'https://example.com/specznak/1'}, ['telegram:specznak']), false);
});

test('several selected channels form a union; clearing selection restores all', () => {
  const rows = [spec, runomer, {vehicle:'car', isSiteListing:true}];
  assert.deepEqual(rows.filter(row => matchesListingSources(row, ['telegram:specznak'])), [spec]);
  assert.deepEqual(rows.filter(row => matchesListingSources(row, ['telegram:specznak','telegram:runomer'])), [spec,runomer]);
  assert.equal(rows.filter(row => matchesListingSources(row, [])).length, 3);
  assert.equal(matchesListingSources(rows[2], ['site']), true);
});

test('source choices count only available listings of the selected vehicle', () => {
  const rows = [spec, runomer, { ...spec, vehicle:'motorcycle', sourceUrl:'https://t.me/specznak/2' }];
  const options = availableListingSources(rows, 'car', new Set([runomer.sourceUrl]));
  assert.deepEqual(options, [{ id:'telegram:specznak', label:'SpecZnak', count:1 }]);
  assert.equal(availableListingSources(rows, 'truck', new Set()).length, 0);
});

test('invalid URLs cannot crash the catalogue', () => {
  assert.equal(listingSource({sourceUrl:'broken'}).id, 'external:unknown');
  assert.equal(listingSource({isSiteListing:true, sourceUrl:spec.sourceUrl}).id, 'site');
});

test('own listings source follows the signed-in owner and can combine with partner sources',()=>{
 const own={vehicle:'car',isSiteListing:true,ownerId:'me'};
 const another={vehicle:'car',isSiteListing:true,ownerId:'other'};
 assert.equal(matchesListingSources(own,['mine'],'me'),true);
 assert.equal(matchesListingSources(another,['mine'],'me'),false);
 assert.equal(matchesListingSources(own,['mine'],''),false);
 assert.equal(matchesListingSources(own,['mine'],'other'),false);
 assert.equal(matchesListingSources(spec,['mine','telegram:specznak'],'me'),true);
 assert.equal(matchesListingSources({...spec,ownerId:'me'},['mine'],'me'),false);
 const choices=availableListingSources([own,another,{...own,vehicle:'truck'},spec],'car',new Set(),'me');
 assert.deepEqual(choices.find(x=>x.id==='mine'),{id:'mine',label:'Свои объявления',count:1});
});
