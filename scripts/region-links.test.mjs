import test from 'node:test';
import assert from 'node:assert/strict';
import {regionFromLink,regionLink,linkedRegions} from '../lib/region-links.ts';
const rows=[{region:'Москва · 77'},{region:'Москва · 797'},{region:'Московская область · 777'},{region:'Краснодарский край · 23'}];
test('Moscow name selects every Moscow code without selecting the oblast',()=>{
 for(const name of ['moskva','moscow','Москва',' МОСКВА '])assert.deepEqual(regionFromLink(name,rows),{region:'Москва',regionCode:''});
 assert.deepEqual(regionFromLink('moskovskaya-oblast',rows),{region:'Московская область',regionCode:''});
});
test('numeric codes select only the requested code, including shared links with tracking',()=>{
 const url=new URL('https://zanomerom.ru/?region=797&utm_source=google');
 assert.deepEqual(regionFromLink(url.searchParams.get('region'),rows),{region:'Москва',regionCode:'797'});
 assert.deepEqual(regionFromLink('23',rows),{region:'Краснодарский край',regionCode:'23'});
});
test('invalid or repeated parameters do not select a misleading region',()=>{
 for(const value of [undefined,'','unknown','77,777',['moskva','23'],'x'.repeat(101)])assert.equal(regionFromLink(value,rows),null);
});
test('all published region links round trip and retain exact region names',()=>{
 const available=linkedRegions.map(item=>({region:`${item.title} · 77`}));
 for(const item of linkedRegions){
  const value=new URL(regionLink(item.title),'https://zanomerom.ru').searchParams.get('region');
  assert.deepEqual(regionFromLink(value,available),{region:item.title,regionCode:''});
 }
});
