export type SaleDetails={city:string;negotiable:boolean;storage:'unspecified'|'vehicle'|'storage';transfer:'discuss'|'sellerVehicle'|'buyerVehicle';sellerType:'private'|'dealer'};
export const emptySaleDetails:SaleDetails={city:'',negotiable:false,storage:'unspecified',transfer:'discuss',sellerType:'private'};
export const storageLabels={unspecified:'Не указано',vehicle:'На автомобиле',storage:'На хранении'};
export const transferLabels={discuss:'Обсудим с покупателем',sellerVehicle:'Через автомобиль продавца',buyerVehicle:'Через автомобиль покупателя'};
export function saleDetails(value:unknown):SaleDetails{
 const v=(value&&typeof value==='object'?value:{}) as Record<string,unknown>;
 return {city:typeof v.city==='string'?v.city.replace(/[\r\n\t]/g,' ').trim().slice(0,80):'',negotiable:v.negotiable===true,
 storage:v.storage==='vehicle'||v.storage==='storage'?v.storage:'unspecified',transfer:v.transfer==='sellerVehicle'||v.transfer==='buyerVehicle'?v.transfer:'discuss',sellerType:v.sellerType==='dealer'?'dealer':'private'};
}
const alphabet:Record<string,string>={A:'А',B:'В',E:'Е',K:'К',M:'М',H:'Н',O:'О',P:'Р',C:'С',T:'Т',Y:'У',X:'Х'};
export const normalizePlate=(s:string)=>s.toUpperCase().replace(/[ABEKMHOPCTYX]/g,x=>alphabet[x]).replace(/[^АВЕКМНОРСТУХ0-9]/g,'');
export function plateCategories(digits:string,letters:string){
 const result:string[]=[];
 if(!/^\d{3,4}$/.test(digits))return result;
 if(/^(\d)\1+$/.test(digits))result.push('Одинаковые цифры');
 if(letters.length>1&&/^(.)\1+$/.test(letters))result.push('Одинаковые буквы');
 if(digits===digits.split('').reverse().join(''))result.push('Зеркальный');
 if(Number(digits)>0&&Number(digits)<=10)result.push('Первая десятка');
 else if(Number(digits)>0&&Number(digits)<100)result.push('Первая сотня');
 if(Number(digits)>0&&digits.endsWith('00'))result.push('Круглый номер');
 if(['123','234','345','456','567','678','789','1234','2345','3456','4567','5678','6789'].includes(digits))result.push('По порядку');
 return result;
}
export const hasSellerContacts=(s:string)=>/(https?:\/\/|www\.|t\.me\/|telegram|whatsapp|\+?\d[\d\s()\-]{8,}|[\w.+-]+@[\w-]+\.[\w.-]+)/i.test(s);
export type ImportListing={row:number;vehicle:'car'|'motorcycle'|'truck';left:string;digits:string;right:string;region:string;price:number;comment:string;details:SaleDetails};
export type ImportIssue={row:number;message:string};
function csvRecords(text:string){
 const first=text.split(/\r?\n/,1)[0];const delimiter=first.includes('\t')?'\t':first.includes(';')?';':',';
 const records:{row:number;cells:string[]}[]=[];let cells:string[]=[],field='',quoted=false,line=1,start=1;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||!field)quoted=!quoted;else field+=c;}
  else if(c===delimiter&&!quoted){cells.push(field.trim());field='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;cells.push(field.trim());if(cells.some(Boolean))records.push({row:start,cells});cells=[];field='';line++;start=line;}
  else{field+=c;if(c==='\n')line++;}
 }
 cells.push(field.trim());if(cells.some(Boolean))records.push({row:start,cells});
 if(quoted)throw new Error('Не закрыты кавычки в CSV. Проверь файл.');
 return records;
}
export function importKey(s:{vehicle:string;left:string;digits:string;right:string;region:string;price:number}){return [s.vehicle,normalizePlate(s.left+s.digits+s.right),String(Number(s.region.split('·').at(-1)?.trim())),s.price].join('|');}
export function parseSellerImport(input:string,existing:ReadonlySet<string>=new Set()){
 const valid:ImportListing[]=[],issues:ImportIssue[]=[];const seen=new Set(existing);
 if(input.length>1_000_000)return {valid,issues:[{row:0,message:'Файл слишком большой. Максимум — 1 МБ.'}]};
 let records;try{records=csvRecords(input.replace(/^\uFEFF/,''));}catch(e){return {valid,issues:[{row:0,message:(e as Error).message}]};}
 const header=records[0]?.cells.map(x=>x.toLowerCase().replace(/\s+/g,' '))??[];
 const aliases:Record<string,string[]>={number:['номер','number','plate'],region:['регион','region'],price:['цена','price'],vehicle:['тип','vehicle','type'],city:['город','city'],comment:['описание','comment','description'],negotiable:['торг','negotiable'],storage:['статус номера','storage'],transfer:['переоформление','transfer'],sellerType:['продавец','seller']};
 const columns=Object.fromEntries(Object.entries(aliases).map(([k,a])=>[k,header.findIndex(x=>a.includes(x))]));
 if(columns.number<0||columns.region<0||columns.price<0)return {valid,issues:[{row:1,message:'Нужны заголовки: номер;регион;цена. Остальные поля необязательные.'}]};
 for(const {row,cells} of records.slice(1)){
  if(valid.length>=50){issues.push({row,message:'В одной отправке максимум 50 объявлений. Остальные отправь следующим списком.'});continue;}
  const get=(key:string)=>(cells[columns[key]]??'').trim();
  const type=get('vehicle').toLowerCase();const vehicle=/^(мото|motorcycle)$/.test(type)?'motorcycle':/^(прицеп|truck|trailer)$/.test(type)?'truck':/^(авто|car|)$/.test(type)?'car':null;
  const number=normalizePlate(get('number'));const match=vehicle==='motorcycle'?number.match(/^(\d{4})([АВЕКМНОРСТУХ]{2})$/):vehicle==='truck'?number.match(/^([АВЕКМНОРСТУХ]{2})(\d{4})$/):number.match(/^([АВЕКМНОРСТУХ])(\d{3})([АВЕКМНОРСТУХ]{2})$/);
  const region=get('region');const priceText=get('price').replace(/[\s\u00a0₽]/g,'').replace(/руб\.?$/i,'');const price=Number(priceText);
  const comment=get('comment');const city=get('city');
  if(!vehicle||!match){issues.push({row,message:'Проверь тип и формат номера. Регион указывается отдельным столбцом.'});continue;}
  if(!/^\d{1,3}$/.test(region)||Number(region)===0){issues.push({row,message:'Укажи код региона из 1–3 цифр.'});continue;}
  if(!/^\d+$/.test(priceText)||!Number.isInteger(price)||price<1000||price>50_000_000){issues.push({row,message:'Цена должна быть целым числом от 1 000 до 50 000 000 ₽.'});continue;}
  if(comment.length>2000||city.length>80||hasSellerContacts(comment+' '+city)){issues.push({row,message:'Проверь город и описание: без контактов и ссылок, описание до 2 000 символов.'});continue;}
  const item:ImportListing={row,vehicle,left:vehicle==='motorcycle'?'':match[1],digits:vehicle==='motorcycle'?match[1]:match[2],right:vehicle==='car'?match[3]:vehicle==='motorcycle'?match[2]:'',region:String(Number(region)).padStart(2,"0"),price,comment,
   details:saleDetails({city,negotiable:/^(да|yes|1|true)$/i.test(get('negotiable')),storage:/^(на хранении|storage)$/i.test(get('storage'))?'storage':/^(на автомобиле|vehicle)$/i.test(get('storage'))?'vehicle':'unspecified',transfer:/^(продавец|sellerVehicle)$/i.test(get('transfer'))?'sellerVehicle':/^(покупатель|buyerVehicle)$/i.test(get('transfer'))?'buyerVehicle':'discuss',sellerType:/^(дилер|dealer)$/i.test(get('sellerType'))?'dealer':'private'})};
  const key=importKey(item);if(seen.has(key)){issues.push({row,message:'Дубль: такой тип, номер, регион и цена уже есть в списке или каталоге.'});continue;}seen.add(key);valid.push(item);
 }
 return {valid,issues};
}
export const sellerCsvTemplate='номер;регион;цена;тип;город;торг;статус номера;переоформление;продавец;описание\nА123АА;77;150000;авто;Москва;да;на хранении;обсудим;частный;Описание предложения';
export function restoredSellerDraft(value:unknown){
 if(!value||typeof value!=='object')return null;const v=value as Record<string,unknown>;
 const text=(key:string,max:number)=>typeof v[key]==='string'?(v[key] as string).slice(0,max):'';
 return {vehicle:v.vehicle==='motorcycle'||v.vehicle==='truck'?v.vehicle:'car' as 'car'|'motorcycle'|'truck',left:text('left',2),digits:text('digits',4),right:text('right',2),region:text('region',3),price:text('price',12),comment:text('comment',2000),details:saleDetails(v.details)};
}
