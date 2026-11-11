import test from 'node:test';
import assert from 'node:assert/strict';
import { listingSource, matchesListingSources, availableListingSources, groupListingSources } from '../lib/listing-sources.ts';
import {snomeramiSources} from './snomerami.mjs';

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

test('regional import channels stay in their own network, not one Telegram group',()=>{
 const rows=[spec,runomer,{vehicle:'car',sourceUrl:'https://t.me/runomer23/1'},
  {vehicle:'car',sourceUrl:'https://t.me/snomerami23/1'}, {vehicle:'car',sourceUrl:'https://t.me/snomerami/2'},
  {vehicle:'car',sourceUrl:'https://t.me/jelezki77/1'}, {vehicle:'car',sourceUrl:'https://t.me/snomerami_fake/1'},
  {vehicle:'car',sourceUrl:'https://t.me/runomer777/1'}, {vehicle:'car',isSiteListing:true}];
 const {groups,direct}=groupListingSources(availableListingSources(rows,'car',new Set()));
 assert.deepEqual(direct.map(x=>x.id),['site']);
 assert.deepEqual(groups.find(x=>x.id==='snomerami').channels.map(x=>x.label),['Краснодарский край','Москва и МО']);
 assert.equal(groups.find(x=>x.id==='runomer').channels.length,2);
 assert.equal(groups.find(x=>x.id==='snomerami').count,2);
 assert.equal(groups.find(x=>x.id==='specznak').channels.length,1);
 assert.equal(groups.find(x=>x.id==='jelezki77').channels.length,1);
 assert.equal(groups.find(x=>x.id==='snomerami_fake').channels.length,1);
 assert.equal(groups.find(x=>x.id==='runomer777').channels.length,1);
});

test('every Snomerami channel in the importer has the same regional label in the filter',()=>{
 const rows=snomeramiSources.map(source=>({vehicle:'car',sourceUrl:`https://t.me/${source.handle}/1`}));
 const {groups}=groupListingSources(availableListingSources(rows,'car',new Set()));
 assert.equal(groups.length,1);
 assert.equal(groups[0].label,'Snomerami');
 assert.equal(groups[0].channels.length,snomeramiSources.length);
 for(const source of snomeramiSources){
  assert.equal(groups[0].channels.find(x=>x.id===`telegram:${source.handle}`).label,source.name.replace('Snomerami · ',''));
 }
});

test('selecting a network uses the existing source union, without including other sources',()=>{
 const rows=[spec,runomer,{vehicle:'car',sourceUrl:'https://t.me/snomerami23/1'}, {vehicle:'car',sourceUrl:'https://t.me/snomerami/1'}];
 const groups=groupListingSources(availableListingSources(rows,'car',new Set())).groups;
 const ids=groups.find(x=>x.id==='snomerami').channels.map(x=>x.id);
 assert.deepEqual(rows.filter(row=>matchesListingSources(row,ids)),rows.slice(2));
 assert.deepEqual(rows.filter(row=>matchesListingSources(row,[...ids,'telegram:specznak'])),[spec,...rows.slice(2)]);
});
