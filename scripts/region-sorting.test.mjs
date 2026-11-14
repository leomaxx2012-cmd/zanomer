import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sortRegions} from '../lib/region-sorting.ts';
const {population}=JSON.parse(fs.readFileSync(new URL('../lib/region-population.json',import.meta.url),'utf8'));
const sample=[{title:'Санкт-Петербург',count:9},{title:'Москва',count:1},{title:'Алтайский край',count:9},{title:'Московская область',count:4},{title:'Регион 666',count:3}];
test('population places Moscow first and unknown regions after known figures',()=>{
 assert.deepEqual(sortRegions(sample,'population',population).map(r=>r.title),['Москва','Московская область','Санкт-Петербург','Алтайский край','Регион 666']);
 assert.equal(Object.keys(population).length,85);
 assert.equal(sortRegions(Object.entries(population).map(([title])=>({title})),'population',population)[0].title,'Москва');
});
test('catalog count is descending, ties are alphabetical and the input is preserved',()=>{
 const original=sample.slice();
 assert.deepEqual(sortRegions(sample,'catalog',population).map(r=>r.count),[9,9,4,3,1]);
 assert.equal(sortRegions(sample,'catalog',population)[0].title,'Алтайский край');
 assert.deepEqual(sample,original);
});
test('alphabetical ordering remains independent of population and count',()=>{
 const sorted=sortRegions(sample,'alphabet',population);
 assert.equal(sorted[0].title,'Алтайский край');
 assert.equal(sorted.at(-1).title,'Санкт-Петербург');
});
