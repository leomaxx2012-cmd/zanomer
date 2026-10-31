import {useTheme} from './AppTheme';
import {useState} from 'react';
import {sellerCsvTemplate} from '../lib/seller-listing';
export function CsvFileInput({onLoad}:{onLoad:(text:string)=>void}){
 const {theme}=useTheme();const [error,setError]=useState('');return <div style={{marginTop:10,fontSize:13,color:theme.accent}}><label style={{display:'block',padding:12,border:'1px solid '+theme.border,borderRadius:12,cursor:'pointer'}}>Открыть CSV или TSV с этого устройства<input aria-label="Выбрать файл CSV или TSV" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" style={{display:'block',marginTop:8,maxWidth:'100%'}} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setError('');if(file.size>1000000){setError('Максимальный размер — 1 МБ.');return;}try{onLoad(await file.text());}catch{setError('Не удалось прочитать файл. Попробуй вставить строки из Excel.');}e.target.value='';}}/></label><a download="zanomerom-listings-template.csv" href={'data:text/csv;charset=utf-8,'+encodeURIComponent('\uFEFF'+sellerCsvTemplate)} style={{display:'inline-block',marginTop:10}}>Скачать шаблон CSV</a>{error&&<p role="alert">{error}</p>}</div>;
}
