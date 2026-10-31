import { type Theme } from '../lib/theme';
import { useTheme, useThemedStyles } from './AppTheme';
import { Pressable } from './ActionPressable';
import {View,StyleSheet} from 'react-native';
import {Text} from './ResponsiveText';
import {emptySaleDetails,storageLabels,transferLabels,type SaleDetails} from '../lib/seller-listing';
export function SellerOptions({value=emptySaleDetails,onChange}:{value:SaleDetails;onChange:(v:SaleDetails)=>void}){
 const s=useThemedStyles(createStyles);
 const {theme}=useTheme();

 const choose=<K extends keyof SaleDetails>(key:K,next:SaleDetails[K])=>onChange({...value,[key]:next});
 return <View style={s.section}>
  <Text style={s.title}>Условия продажи</Text>
  <Pressable accessibilityRole="checkbox" accessibilityState={{checked:value.negotiable}} aria-checked={value.negotiable} onPress={()=>choose('negotiable',!value.negotiable)} style={[s.option,value.negotiable&&s.active]}><Text style={s.label}>{value.negotiable?'✓':'○'} Возможен торг</Text></Pressable>
  <Text style={s.caption}>Где находится номер</Text>
  <View style={s.row}>{Object.entries(storageLabels).map(([key,label])=><Pressable key={key} accessibilityRole="radio" accessibilityState={{checked:value.storage===key}} aria-checked={value.storage===key} onPress={()=>choose('storage',key as SaleDetails['storage'])} style={[s.option,value.storage===key&&s.active]}><Text style={s.label}>{label}</Text></Pressable>)}</View>
  <Text style={s.caption}>Предпочтительный способ переоформления</Text>
  <View style={s.row}>{Object.entries(transferLabels).map(([key,label])=><Pressable key={key} accessibilityRole="radio" accessibilityState={{checked:value.transfer===key}} aria-checked={value.transfer===key} onPress={()=>choose('transfer',key as SaleDetails['transfer'])} style={[s.option,value.transfer===key&&s.active]}><Text style={s.label}>{label}</Text></Pressable>)}</View>
  <Text style={s.caption}>Кто размещает</Text>
  <View style={s.row}>{([['private','Частный продавец'],['dealer','Дилер']] as const).map(([key,label])=><Pressable key={key} accessibilityRole="radio" accessibilityState={{checked:value.sellerType===key}} aria-checked={value.sellerType===key} onPress={()=>choose('sellerType',key)} style={[s.option,value.sellerType===key&&s.active]}><Text style={s.label}>{label}</Text></Pressable>)}</View>
 </View>;
}
const createStyles = (theme:Theme) => StyleSheet.create({section:{gap:10,marginTop:18},title:{fontSize:17,fontWeight:'800',color:theme.text},caption:{fontSize:12,color:theme.muted,marginTop:7},row:{flexDirection:'row',flexWrap:'wrap',gap:8},option:{padding:12,borderWidth:1,borderColor:theme.border,borderRadius:12,backgroundColor:theme.surface,minHeight:44,justifyContent:'center'},active:{backgroundColor:theme.accentSurface,borderColor:theme.accentBorder},label:{fontSize:12,color:theme.accent,fontWeight:'600'},input:{borderWidth:1,borderColor:theme.border,borderRadius:12,padding:14,fontSize:15,color:theme.text,backgroundColor:theme.surface}});
