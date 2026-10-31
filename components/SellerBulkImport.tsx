import { type Theme } from '../lib/theme';
import { useTheme, useThemedStyles } from './AppTheme';
import { Pressable } from './ActionPressable';
import {useMemo,useState} from 'react';
import {View,StyleSheet,Platform} from 'react-native';
import {Text,TextInput} from './ResponsiveText';
import {CsvFileInput} from './CsvFileInput';
import {parseSellerImport,sellerCsvTemplate,type ImportListing} from '../lib/seller-listing';
export function SellerBulkImport({existing,signedIn,onLogin,onSubmit}:{existing:ReadonlySet<string>;signedIn:boolean;onLogin:()=>void;onSubmit:(rows:ImportListing[])=>Promise<string>}){
 const s=useThemedStyles(createStyles);
 const {theme}=useTheme();

 const [text,setText]=useState(''),[showTemplate,setShowTemplate]=useState(false),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const parsed=useMemo(()=>parseSellerImport(text,existing),[text,existing]);
 const update=(value:string)=>{setText(value);setConfirmed(false);setMessage('');};
 async function publish(){if(!signedIn){onLogin();return;}if(!confirmed||!parsed.valid.length||busy)return;setBusy(true);setMessage('');try{setMessage(await onSubmit(parsed.valid));setConfirmed(false);}catch{setMessage('Отправка не удалась. Список сохранён — проверь соединение и повтори.');}finally{setBusy(false);}}
 return <View style={s.panel}>
  <Text style={s.title}>Загрузить список номеров</Text><Text style={s.hint}>{Platform.OS==="web"?"Выбери CSV/TSV или вставь строки вместе с заголовками из Excel.":"Вставь строки вместе с заголовками из Excel."} В одной отправке — до 50 объявлений. Каждый номер проходит обычную модерацию.</Text>
  <Pressable accessibilityRole="button" onPress={()=>setShowTemplate(x=>!x)} style={s.secondary}><Text style={s.secondaryText}>{showTemplate?'Скрыть шаблон':'Показать шаблон CSV'}</Text></Pressable>
  {showTemplate&&<Text selectable style={s.template}>{sellerCsvTemplate}</Text>}
  <CsvFileInput onLoad={update}/>
  <TextInput accessibilityLabel="Список номеров из CSV или Excel" value={text} onChangeText={update} multiline maxLength={1000000} placeholder="номер;регион;цена;тип" style={s.input}/>
  {!!text&&<><Text style={s.summary}>Готово к отправке: {parsed.valid.length} · замечаний: {parsed.issues.length}</Text>
   {parsed.valid.slice(0,50).map(row=><View key={row.row} style={s.valid}><Text style={s.plate}>{[row.left,row.digits,row.right].filter(Boolean).join(' ')} · {row.region}</Text><Text style={s.hint}>{row.price.toLocaleString('ru-RU')} ₽</Text></View>)}
   {parsed.issues.slice(0,50).map((row,i)=><Text key={i} style={s.issue}>Строка {row.row}: {row.message}</Text>)}{parsed.issues.length>50&&<Text style={s.issue}>Ещё замечаний: {parsed.issues.length-50}. Исправь список и проверь снова.</Text>}
  </>}
  <Pressable accessibilityRole="checkbox" accessibilityState={{checked:confirmed}} aria-checked={confirmed} onPress={()=>setConfirmed(x=>!x)} style={s.confirm}><Text style={s.hint}>{confirmed?'☑':'☐'} Подтверждаю, что это мои предложения или у меня есть разрешение владельцев на размещение. Данные проверены.</Text></Pressable>
  <Pressable accessibilityRole="button" disabled={busy||(!confirmed&&signedIn)||!parsed.valid.length} onPress={()=>void publish()} style={[s.publish,(busy||(!confirmed&&signedIn)||!parsed.valid.length)&&{opacity:0.45}]}><Text style={s.publishText}>{busy?'Отправляем…':signedIn?`Отправить корректные объявления · ${parsed.valid.length}`:'Войти для отправки'}</Text></Pressable>
  {!!message&&<Text accessibilityLiveRegion="polite" style={s.summary}>{message}</Text>}
 </View>;
}
const createStyles = (theme:Theme) => StyleSheet.create({panel:{alignSelf:'center',width:'100%',maxWidth:860,backgroundColor:theme.surface,borderRadius:22,padding:20,gap:12,borderWidth:1,borderColor:theme.border,marginTop:20},title:{fontSize:21,fontWeight:'800',color:theme.text},hint:{fontSize:13,lineHeight:20,color:theme.muted},secondary:{padding:12,borderRadius:12,backgroundColor:theme.raised},secondaryText:{fontSize:13,color:theme.accent,fontWeight:'700'},template:{fontSize:12,lineHeight:20,color:theme.accent,padding:12,backgroundColor:theme.raised},input:{fontSize:13,lineHeight:20,minHeight:150,padding:14,borderWidth:1,borderColor:theme.border,borderRadius:12,color:theme.text,textAlignVertical:'top'},summary:{fontSize:14,lineHeight:21,fontWeight:'700',color:theme.accent},valid:{borderBottomWidth:1,borderBottomColor:theme.border,paddingVertical:8},plate:{fontSize:15,fontWeight:'700',color:theme.text},issue:{fontSize:12,lineHeight:19,color:theme.warning},confirm:{paddingVertical:12},publish:{padding:15,minHeight:48,borderRadius:12,backgroundColor:'#6551D3',alignItems:'center',justifyContent:'center'},publishText:{color:theme.onPrimary,fontSize:14,fontWeight:'800'}});
