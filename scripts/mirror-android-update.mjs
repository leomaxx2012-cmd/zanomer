import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const config=JSON.parse(await readFile(new URL('../app.json',import.meta.url),'utf8')).expo;
const response=await fetch(config.updates.url,{headers:{accept:'multipart/mixed,application/expo+json,application/json','expo-platform':'android','expo-runtime-version':config.version,'expo-channel-name':'production','expo-protocol-version':'1'},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('Manifest HTTP '+response.status);
const type=response.headers.get('content-type')??'';
const body=await response.text();
const boundary=type.match(/boundary="?([^";]+)/i)?.[1];
let manifest,extensions;
for(const part of boundary?body.split('--'+boundary):[body]) {
  const start=part.indexOf('{'); if(start<0)continue;
  try {const value=JSON.parse(part.slice(start).trim());if(value.launchAsset)manifest=value;if(value.assetRequestHeaders)extensions=value;}catch{}
}
if(!manifest||manifest.runtimeVersion!==config.version||manifest.extra?.expoClient?.android?.package!==config.android.package)throw Error('Missing or incompatible manifest');
const output=new URL('../public/mobile-updates/',import.meta.url);
await mkdir(new URL('assets/',output),{recursive:true});
const assets=[manifest.launchAsset,...manifest.assets];
for(let start=0;start<assets.length;start+=4) {
  await Promise.all(assets.slice(start,start+4).map(async asset=>{
    const url=new URL(asset.url);
    if(url.protocol!=='https:'||url.hostname!=='assets.eascdn.net')throw Error('Unexpected asset origin');
    const key=createHash('sha256').update(url.hostname+url.pathname).digest('hex');
    const file=new URL('assets/'+key,output);
    const valid=bytes=>[createHash('sha256').update(bytes).digest('base64url'),createHash('sha256').update(bytes).digest('hex')].includes(asset.hash);
    let bytes;
    try {bytes=await readFile(file);if(!valid(bytes))bytes=undefined;}catch{}
    if(!bytes) {
      const remote=await fetch(url,{headers:extensions?.assetRequestHeaders?.[asset.key]??{},signal:AbortSignal.timeout(45000)});
      if(!remote.ok)throw Error('Asset HTTP '+remote.status);
      bytes=Buffer.from(await remote.arrayBuffer());
      if(!valid(bytes))throw Error('Asset integrity mismatch');
      await writeFile(file,bytes);
    }
    asset.url='https://zanomerom.ru/mobile-updates/assets/'+key;
  }));
}
const directory=new URL(config.version+'/',output);
await mkdir(directory,{recursive:true});
// Write manifest last, after all required files exist and their hashes pass.
await writeFile(new URL('manifest.json',directory),JSON.stringify(manifest));
console.log(JSON.stringify({updateId:manifest.id,runtimeVersion:manifest.runtimeVersion,verifiedFiles:assets.length,path:join('public','mobile-updates',config.version,'manifest.json')}));
