export type CatalogSearch = {
 leftLetter:string; digits:string; rightLetters:string; region:string; regionCode:string;
 vehicle:'car'|'motorcycle'|'truck'; priceLimit:number|null; specialFilters:string[];
 selectedSources:string[]; freshOnly:boolean; groupSeries:boolean; sort:'date'|'priceAsc'|'priceDesc';
};
type Params = Record<string,string|string[]|undefined>;
const single=(p:Params,k:string,max=160)=>typeof p[k]==='string'&&p[k].length<=max?p[k] as string:'';
const letters=(s:string,n:number)=>s.toUpperCase().replace(/[^АВЕКМНОРСТУХABEKMHOPCTYX*]/g,'').slice(0,n);
const list=(s:string)=>[...new Set(s.split(',').filter(Boolean))];
export function readCatalogSearch(p:Params):CatalogSearch {
 const v=single(p,'vehicle'); const vehicle=v==='motorcycle'||v==='truck'?v:'car';
 const price=Number(single(p,'price')); const sort=single(p,'sort');
 return {vehicle,leftLetter:letters(single(p,'left'),vehicle==='truck'?2:1),
 digits:single(p,'digits').replace(/[^0-9*]/g,'').slice(0,vehicle==='car'?3:4),
 rightLetters:letters(single(p,'right'),2),region:single(p,'area')||'Все',
 regionCode:list(single(p,'codes')).filter(x=>/^\d{2,3}$/.test(x)).join(','),
 priceLimit:Number.isFinite(price)&&price>0?price:null,
 specialFilters:list(single(p,'features')).filter(x=>['firstTen','roundHundred','mirror','repeatDigits','repeatLetters','similarDigits','similarLetters','similarRegion'].includes(x)),
 selectedSources:list(single(p,'sources',500)).filter(x=>x==='site'||/^telegram:[a-zA-Z0-9_]+$/.test(x)),
 freshOnly:single(p,'fresh')==='1',groupSeries:single(p,'series')==='1',sort:sort==='priceAsc'||sort==='priceDesc'?sort:'date'};
}
export function catalogSearchParams(s:CatalogSearch):Record<string,string> {
 const p:Record<string,string>={vehicle:s.vehicle};
 if(s.leftLetter)p.left=s.leftLetter;if(s.digits)p.digits=s.digits;if(s.rightLetters)p.right=s.rightLetters;
 if(s.region!=='Все')p.area=s.region;if(s.regionCode)p.codes=s.regionCode;
 if(s.priceLimit!==null)p.price=String(s.priceLimit);if(s.specialFilters.length)p.features=s.specialFilters.join(',');
 if(s.groupSeries)p.series='1';if(s.selectedSources.length)p.sources=s.selectedSources.join(',');if(s.freshOnly)p.fresh='1';if(s.sort!=='date')p.sort=s.sort;
 return p;
}
