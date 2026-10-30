import {Pressable,View,StyleSheet} from 'react-native';
import {Text,TextInput} from './ResponsiveText';
import {emptySaleDetails,storageLabels,transferLabels,type SaleDetails} from '../lib/seller-listing';
export function SellerOptions({value=emptySaleDetails,onChange}:{value:SaleDetails;onChange:(v:SaleDetails)=>void}){
 const choose=<K extends keyof SaleDetails>(key:K,next:SaleDetails[K])=>onChange({...value,[key]:next});
 return <View style={s.section}>
  <Text style={s.title}>Город и условия</Text>
  <TextInput accessibilityLabel="Город продажи" value={value.city} onChangeText={city=>choose('city',city)} placeholder="Город, например Москва" maxLength={80} style={s.input}/>
  <Pressable accessibilityRole="checkbox" accessibilityState={{checked:value.negotiable}} aria-checked={value.negotiable} onPress={()=>choose('negotiable',!value.negotiable)} style={[s.option,value.negotiable&&s.active]}><Text style={s.label}>{value.negotiable?'✓':'○'} Возможен торг</Text></Pressable>
  <Text style={s.caption}>Где находится номер</Text>
  <View style={s.row}>{Object.entries(storageLabels).map(([key,label])=><Pressable key={key} accessibilityRole="radio" accessibilityState={{checked:value.storage===key}} aria-checked={value.storage===key} onPress={()=>choose('storage',key as SaleDetails['storage'])} style={[s.option,value.storage===key&&s.active]}><Text style={s.label}>{label}</Text></Pressable>)}</View>
  <Text style={s.caption}>Предпочтительный способ переоформления</Text>
  <View style={s.row}>{Object.entries(transferLabels).map(([key,label])=><Pressable key={key} accessibilityRole="radio" accessibilityState={{checked:value.transfer===key}} aria-checked={value.transfer===key} onPress={()=>choose('transfer',key as SaleDetails['transfer'])} style={[s.option,value.transfer===key&&s.active]}><Text style={s.label}>{label}</Text></Pressable>)}</View>
  <Text style={s.caption}>Кто размещает</Text>
  <View style={s.row}>{([['private','Частный продавец'],['dealer','Дилер']] as const).map(([key,label])=><Pressable key={key} accessibilityRole="radio" accessibilityState={{checked:value.sellerType===key}} aria-checked={value.sellerType===key} onPress={()=>choose('sellerType',key)} style={[s.option,value.sellerType===key&&s.active]}><Text style={s.label}>{label}</Text></Pressable>)}</View>
 </View>;
}
const s=StyleSheet.create({section:{gap:10,marginTop:18},title:{fontSize:17,fontWeight:'800',color:'#24213E'},caption:{fontSize:12,color:'#667085',marginTop:7},row:{flexDirection:'row',flexWrap:'wrap',gap:8},option:{padding:12,borderWidth:1,borderColor:'#E0DCEC',borderRadius:12,backgroundColor:'#F8F7FC',minHeight:44,justifyContent:'center'},active:{backgroundColor:'#ECE8FF',borderColor:'#7662D6'},label:{fontSize:12,color:'#423968',fontWeight:'600'},input:{borderWidth:1,borderColor:'#D8D4E6',borderRadius:12,padding:14,fontSize:15,color:'#24213E',backgroundColor:'white'}});
