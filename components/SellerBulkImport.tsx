import { Pressable } from './ActionPressable';
import {useMemo,useState} from 'react';
import {View,StyleSheet,Platform} from 'react-native';
import {Text,TextInput} from './ResponsiveText';
import {CsvFileInput} from './CsvFileInput';
import {parseSellerImport,sellerCsvTemplate,type ImportListing} from '../lib/seller-listing';
export function SellerBulkImport({existing,signedIn,onLogin,onSubmit}:{existing:ReadonlySet<string>;signedIn:boolean;onLogin:()=>void;onSubmit:(rows:ImportListing[])=>Promise<string>}){
 const [text,setText]=useState(''),[showTemplate,setShowTemplate]=useState(false),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const parsed=useMemo(()=>parseSellerImport(text,existing),[text,existing]);
 const update=(value:string)=>{setText(value);setConfirmed(false);setMessage('');};
 async function publish(){if(!signedIn){onLogin();return;}if(!confirmed||!parsed.valid.length||busy)return;setBusy(true);setMessage('');try{setMessage(await onSubmit(parsed.valid));setConfirmed(false);}catch{setMessage('Отправка не удалась. Список сохранён — проверь соединение и повтори.');}finally{setBusy(false);}}
 return <View style={s.panel}>
  <Text style={s.title}>Загрузить список номеров</Text><Text style={s.hint}>{Platform.OS==="web"?"Выбери CSV/TSV или вставь строки вместе с заголовками из Excel.":"Вставь строки вместе с заголовками из Excel."} В одной отправке — до 50 объявлений. Каждый номер проходит обычную модерацию.</Text>
  <Pressable accessibilityRole="button" onPress={()=>setShowTemplate(x=>!x)} style={s.secondary}><Text style={s.secondaryText}>{showTemplate?'Скрыть шаблон':'Показать шаблон CSV'}</Text></Pressable>
  {showTemplate&&<Text selectable style={s.template}>{sellerCsvTemplate}</Text>}
  <CsvFileInput onLoad={update}/>
  <TextInput accessibilityLabel="Список номеров из CSV или Excel" value={text} onChangeText={update} multiline maxLength={1000000} placeholder="номер;регион;цена;тип;город" style={s.input}/>
  {!!text&&<><Text style={s.summary}>Готово к отправке: {parsed.valid.length} · замечаний: {parsed.issues.length}</Text>
   {parsed.valid.slice(0,50).map(row=><View key={row.row} style={s.valid}><Text style={s.plate}>{[row.left,row.digits,row.right].filter(Boolean).join(' ')} · {row.region}</Text><Text style={s.hint}>{row.price.toLocaleString('ru-RU')} ₽{row.details.city?` · ${row.details.city}`:''}</Text></View>)}
   {parsed.issues.slice(0,50).map((row,i)=><Text key={i} style={s.issue}>Строка {row.row}: {row.message}</Text>)}{parsed.issues.length>50&&<Text style={s.issue}>Ещё замечаний: {parsed.issues.length-50}. Исправь список и проверь снова.</Text>}
  </>}
  <Pressable accessibilityRole="checkbox" accessibilityState={{checked:confirmed}} aria-checked={confirmed} onPress={()=>setConfirmed(x=>!x)} style={s.confirm}><Text style={s.hint}>{confirmed?'☑':'☐'} Подтверждаю, что это мои предложения или у меня есть разрешение владельцев на размещение. Данные проверены.</Text></Pressable>
  <Pressable accessibilityRole="button" disabled={busy||(!confirmed&&signedIn)||!parsed.valid.length} onPress={()=>void publish()} style={[s.publish,(busy||(!confirmed&&signedIn)||!parsed.valid.length)&&{opacity:0.45}]}><Text style={s.publishText}>{busy?'Отправляем…':signedIn?`Отправить корректные объявления · ${parsed.valid.length}`:'Войти для отправки'}</Text></Pressable>
  {!!message&&<Text accessibilityLiveRegion="polite" style={s.summary}>{message}</Text>}
 </View>;
}
const s=StyleSheet.create({panel:{alignSelf:'center',width:'100%',maxWidth:860,backgroundColor:'white',borderRadius:22,padding:20,gap:12,borderWidth:1,borderColor:'#E5E1F0',marginTop:20},title:{fontSize:21,fontWeight:'800',color:'#24213E'},hint:{fontSize:13,lineHeight:20,color:'#667085'},secondary:{padding:12,borderRadius:12,backgroundColor:'#F0ECFF'},secondaryText:{fontSize:13,color:'#5143C2',fontWeight:'700'},template:{fontSize:12,lineHeight:20,color:'#423968',padding:12,backgroundColor:'#F5F3FB'},input:{fontSize:13,lineHeight:20,minHeight:150,padding:14,borderWidth:1,borderColor:'#D8D4E6',borderRadius:12,color:'#24213E',textAlignVertical:'top'},summary:{fontSize:14,lineHeight:21,fontWeight:'700',color:'#5143C2'},valid:{borderBottomWidth:1,borderBottomColor:'#F0EDF5',paddingVertical:8},plate:{fontSize:15,fontWeight:'700',color:'#24213E'},issue:{fontSize:12,lineHeight:19,color:'#B42318'},confirm:{paddingVertical:12},publish:{padding:15,minHeight:48,borderRadius:12,backgroundColor:'#6551D3',alignItems:'center',justifyContent:'center'},publishText:{color:'white',fontSize:14,fontWeight:'800'}});
