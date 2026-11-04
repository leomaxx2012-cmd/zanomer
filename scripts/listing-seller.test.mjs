import test from 'node:test';
import assert from 'node:assert/strict';
import {listingSellerName} from '../lib/listing-seller.ts';
import {readCatalogSearch,catalogSearchParams} from '../lib/catalog-navigation.ts';

test('own cards show the current nickname even when the catalogue cached a fallback',()=>{
 assert.equal(listingSellerName({isSiteListing:true,ownerId:'me',seller:'Пользователь ЗаНомером'},'me','Max'),'Max');
 assert.equal(listingSellerName({isSiteListing:true,ownerId:'other',seller:'Leon'},'me','Max'),'Leon');
 assert.equal(listingSellerName({seller:'Runomer'},'me','Max'),'Runomer');
 assert.equal(listingSellerName({isSiteListing:true,ownerId:'me'},'',''),'Пользователь ЗаНомером');
});
test('own-source search links preserve the source across navigation',()=>{
 const search=readCatalogSearch({sources:'mine,telegram:specznak'});
 assert.deepEqual(search.selectedSources,['mine','telegram:specznak']);
 assert.deepEqual(readCatalogSearch(catalogSearchParams(search)).selectedSources,search.selectedSources);
});
