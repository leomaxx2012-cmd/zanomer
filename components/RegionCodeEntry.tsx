import { useReducer } from 'react';
import { View } from 'react-native';
import { Pressable } from './ActionPressable';
import { Text } from './ResponsiveText';
import { useTheme } from './AppTheme';
import { initialRegionCodeEntry, regionCodeEntryReducer, validRegionCodeEntry } from '../lib/region-code-entry';

export function RegionCodeEntry({ onApply, initialValue = '', actionLabel = 'Найти' }: {
  onApply: (code: string) => void; initialValue?: string; actionLabel?: string;
}) {
  const { theme } = useTheme();
  const [entry, dispatch] = useReducer(regionCodeEntryReducer, initialValue, initialRegionCodeEntry);
  const { value, position, open, length } = entry;
  const valid = validRegionCodeEntry(entry);
  const button = { minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 9, borderWidth: 1, borderColor: theme.border };
  return <View style={{ gap: 8, padding: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 12 }}>
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
      <Text style={{ flex:1, color: theme.text, fontSize: 13, fontWeight: '800' }}>Код региона цифрами</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Очистить код региона" onPress={() => dispatch({type:'clear'})} style={[button, { width: 36, minHeight:36 }]} hitSlop={4}>
        <Text style={{ color: theme.muted, fontSize: 24 }}>×</Text>
      </Pressable>
    </View>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {([3,2] as const).map(size => <View key={size} style={{flex:size,minWidth:0,gap:5}}>
        <Text style={{color:length===size?theme.accent:theme.muted,fontSize:11,fontWeight:'700'}}>{size} цифры</Text>
        <View style={{flexDirection:'row',gap:4}}>
          {Array.from({length:size},(_,index)=>{
            const selected = open && length===size && index===position;
            const character = length===size ? value[index]?.trim() : '';
            return <Pressable key={index} accessibilityRole="button"
              accessibilityLabel={`Цифра ${size===3?'трёхзначного':'двухзначного'} региона ${index+1}`}
              accessibilityValue={{text:character||'пусто'}} accessibilityState={{selected}}
              onPress={()=>dispatch({type:'select',length:size,index})}
              style={[button,{flex:1,maxWidth:44,minHeight:0,aspectRatio:1,borderRadius:6,
                borderWidth:selected?2:1,borderColor:selected?theme.accent:theme.border,
                backgroundColor:selected?theme.accentSurface:theme.surface}]}>
              <Text allowFontScaling={false} style={{color:selected?theme.accent:theme.text,fontSize:22,fontWeight:'800'}}>{character||'—'}</Text>
            </Pressable>;
          })}
        </View>
      </View>)}
    </View>
    {open && <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {['1','2','3','4','5','6','7','8','9','0'].map(digit => <Pressable key={digit} accessibilityRole="button" accessibilityLabel={`Ввести цифру региона ${digit}`}
          onPress={() => dispatch({type:'digit',digit})} style={[button, { width: '22%', flexGrow: 1, backgroundColor: theme.surface }]}>
          <Text style={{ color: theme.accent, fontSize: 18, fontWeight: '800' }}>{digit}</Text>
        </Pressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel="Удалить выбранную цифру региона" onPress={() => dispatch({type:'erase'})} style={[button, { width: '22%', flexGrow: 1 }]}><Text style={{ color: theme.accent, fontSize: 20 }}>⌫</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Скрыть клавиатуру региона" onPress={() => dispatch({type:'close'})} style={[button, { width: '22%', flexGrow: 1 }]}><Text style={{ color: theme.muted, fontSize: 22 }}>×</Text></Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} disabled={!valid} accessibilityState={{ disabled: !valid }}
        onPress={() => { if (valid) { onApply(value); dispatch({type:'close'}); } }} style={[button, { backgroundColor: '#5143C2', opacity: valid ? 1 : 0.4 }]}>
        <Text style={{ color: theme.onPrimary, fontWeight: '800' }}>{actionLabel}</Text>
      </Pressable>
    </>}
    <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 16 }}>Слева — для трёх цифр региона, справа — для двух.</Text>
  </View>;
}
