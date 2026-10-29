import test from 'node:test';
import assert from 'node:assert/strict';
import {forEachCatalogChunk,mapCatalogChunks,serializeCatalogChunks,mergeCatalogOffers,mergeCatalogOffersInChunks} from '../lib/catalog-offers.ts';
import {buildSeriesGroups,buildSimilarityCounts,hasSimilarCatalogOffer} from '../lib/catalog-similarity.ts';

test('catalogue work yields to queued events and cancels without a partial result', async()=>{
 let event=false;setTimeout(()=>{event=true},0);
 const result=await mapCatalogChunks(Array.from({length:130},(_,i)=>i),i=>i*2);
 assert.equal(event,true);assert.equal(result[129],258);
 let active=true,visited=0;
 assert.equal(await mapCatalogChunks([1,2,3],i=>{visited++;return i},{maxBatchSize:1,isActive:()=>active,yieldNow:async()=>{active=false}}),null);
 assert.equal(visited,1);
});
test('elapsed work budget yields even below batch limit',async()=>{
 let clock=0,yields=0;
 await forEachCatalogChunk([1,2,3,4],()=>{clock+=4},{now:()=>clock,budgetMs:6,yieldNow:async()=>{yields++}});
 assert.equal(yields,1);
});
test('chunked JSON preserves offline cache format',async()=>{
 const rows=[{text:'Номер "А" 🥚'},null,undefined,23];
 assert.equal(await serializeCatalogChunks(rows),JSON.stringify(rows));
 assert.equal(await serializeCatalogChunks(rows,{isActive:()=>false}),null);
});
const offer={id:'1',vehicle:'car',leftLetter:'А',digits:'111',rightLetters:'АА',region:'Москва · 77',priceValue:100,sourceUrl:'https://t.me/runomer/1',createdAt:'2026-10-07',seller:' Seller '};
test('chunked merge preserves price updates, distinct offers, metadata and identities',async()=>{
 const other={...offer,id:'2',digits:'222',sourceUrl:'https://t.me/runomer/2'};
 const current=[offer,other];
 assert.equal(await mergeCatalogOffersInChunks(current,[{...offer}]),current);
 for(const incoming of [[{...offer,priceValue:200}],[{...offer,id:'3',region:'Регион · 99',sourceUrl:'https://t.me/runomer/3'}],[{...offer,seller:'Updated'}],[]]){
  assert.deepEqual(await mergeCatalogOffersInChunks(current,incoming),mergeCatalogOffers(current,incoming));
 }
 assert.equal(await mergeCatalogOffersInChunks(current,[{...other,priceValue:300}],{isActive:()=>false}),null);
});
function naive(rows){
 const result=new Map(),seen=new Set();
 const related=(a,b)=>{
  if(a.id===b.id||a.vehicle!==b.vehicle||a.seller.trim().toLocaleLowerCase('ru-RU')!==b.seller.trim().toLocaleLowerCase('ru-RU'))return false;
  const x=a.leftLetter+a.digits+a.rightLetters,y=b.leftLetter+b.digits+b.rightLetters;
  const r=a.region.split(' · ')[1]?.trim()??'',s=b.region.split(' · ')[1]?.trim()??'';
  if(x===y)return !!r&&!!s&&r!==s;
  return x.length===y.length&&[...x].filter((c,i)=>c!==y[i]).length===1;
 };
 for(const row of rows){if(seen.has(row.id))continue;const group=[row];seen.add(row.id);
  for(let i=0;i<group.length;i++)for(const next of rows)if(!seen.has(next.id)&&related(group[i],next)){group.push(next);seen.add(next.id)}
  if(group.length>1){const value={key:group.map(r=>r.id).sort()[0],size:group.length};for(const r of group)result.set(r.id,value)}
 }return [...result].sort(([a],[b])=>a<b?-1:1);
}
test('indexed groups match pairwise relation, including transitive and unknown-region cases',()=>{
 let seed=357;const random=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n};
 for(let run=0;run<40;run++){
  const rows=Array.from({length:90},(_,i)=>({...offer,id:String(i),seller:['Seller',' seller ','Other'][random(3)],vehicle:['car','moto'][random(2)],leftLetter:['А','В'][random(2)],digits:String(110+random(8)),rightLetters:['АА','АВ'][random(2)],region:['Unknown','R · 77','R · 99','R · '][random(4)]}));
  assert.deepEqual([...buildSeriesGroups(rows)].sort(([a],[b])=>a<b?-1:1),naive(rows));
  const counts=buildSimilarityCounts(rows);
  for(const row of rows)for(const kind of ['similarDigits','similarLetters','similarRegion']){
   const expected=rows.some(other=>other.id!==row.id&&other.vehicle===row.vehicle&&(kind==='similarDigits'?other.digits===row.digits:kind==='similarLetters'?other.leftLetter===row.leftLetter&&other.rightLetters===row.rightLetters:other.region.split(' · ')[1]?.trim()===row.region.split(' · ')[1]?.trim()));
   assert.equal(hasSimilarCatalogOffer(row,kind,counts),expected);
  }
 }
});
