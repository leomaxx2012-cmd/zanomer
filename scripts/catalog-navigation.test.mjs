import test from 'node:test';
import assert from 'node:assert/strict';
import {readCatalogSearch,catalogSearchParams} from '../lib/catalog-navigation.ts';
const example={leftLetter:'А',digits:'1*3',rightLetters:'ВВ',region:'Москва',regionCode:'77,97',vehicle:'car',priceLimit:300000,specialFilters:['mirror'],selectedSources:['telegram:runomer','site'],freshOnly:true,groupSeries:true,sort:'priceAsc'};
test('all selected filters survive a shared results link and a reload',()=>assert.deepEqual(readCatalogSearch(catalogSearchParams(example)),example));
test('motorcycle and trailer four-digit searches survive navigation',()=>{for(const vehicle of ['motorcycle','truck']){const s={...example,vehicle,digits:'1234',leftLetter:vehicle==='truck'?'АА':''};assert.deepEqual(readCatalogSearch(catalogSearchParams(s)),s);}});
test('untrusted and repeated parameters cannot inject filters or unlimited input',()=>{const s=readCatalogSearch({vehicle:'plane',digits:['123'],price:'Infinity',features:'mirror,garbage,mirror',sources:'site,https://evil.test',codes:'77,1,abc,977,77',area:['Москва']});assert.equal(s.vehicle,'car');assert.equal(s.digits,'');assert.equal(s.priceLimit,null);assert.deepEqual(s.specialFilters,['mirror']);assert.deepEqual(s.selectedSources,['site']);assert.equal(s.regionCode,'77,977');assert.equal(s.region,'Все');});
test('an empty query is an unrestricted car search',()=>{const s=readCatalogSearch({});assert.equal(s.vehicle,'car');assert.equal(s.region,'Все');assert.equal(s.priceLimit,null);assert.deepEqual(s.specialFilters,[]);});
