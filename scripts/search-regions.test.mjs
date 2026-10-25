import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedSearchRegionCodes, searchRegionNames, toggleSearchRegion, compactSearchRegions } from '../lib/search-regions.ts';

const groups = [
  { title: 'Москва', codes: [{ value: '77' }, { value: '777' }] },
  { title: 'Краснодарский край', codes: [{ value: '23' }, { value: '123' }] },
];

test('whole regions accumulate and show both names; removing one preserves the other', () => {
  let state = toggleSearchRegion(groups, 'Все', '', ['77', '777']);
  state = toggleSearchRegion(groups, state.region, state.regionCode, ['23', '123']);
  assert.deepEqual(searchRegionNames(groups, selectedSearchRegionCodes(groups, state.region, state.regionCode)), ['Москва', 'Краснодарский край']);
  assert.equal(state.regionCode, '23,77,123,777');
  state = toggleSearchRegion(groups, state.region, state.regionCode, ['77', '777']);
  assert.deepEqual(state, { region: 'Краснодарский край', regionCode: '23,123' });
});

test('individual codes from different regions keep all names and reset when cleared', () => {
  let state = toggleSearchRegion(groups, 'Все', '', ['77']);
  state = toggleSearchRegion(groups, state.region, state.regionCode, ['23']);
  assert.deepEqual(searchRegionNames(groups, state.regionCode.split(',')), ['Москва', 'Краснодарский край']);
  state = toggleSearchRegion(groups, state.region, state.regionCode, ['77', '23']);
  assert.deepEqual(state, { region: 'Все', regionCode: '' });
});

test('legacy whole-region search is preserved when another region is added', () => {
  const state = toggleSearchRegion(groups, 'Москва', '', ['23']);
  assert.equal(state.regionCode, '23,77,777');
  assert.equal(state.region, 'Москва, Краснодарский край');
});

test('names use only the available vehicle-specific groups', () => {
  assert.deepEqual(searchRegionNames(groups.slice(1), ['77', '23']), ['Краснодарский край']);
});

test('compact labels name only fully selected regions', () => {
  assert.deepEqual(compactSearchRegions(groups,['77','23']),{codes:'77, 23',names:''});
  assert.deepEqual(compactSearchRegions(groups,['77','777','23']),{codes:'77 +2',names:'Мск'});
  assert.equal(compactSearchRegions(groups,['77','777','23','123']).names,'Мск, Краснодар. кр.');
  assert.deepEqual(compactSearchRegions([],[]),{codes:'—',names:''});
  assert.equal(compactSearchRegions([{title:'Московская область',codes:[{value:'50'},{value:'750'}]}],['50','750']).names,'МО');
});
