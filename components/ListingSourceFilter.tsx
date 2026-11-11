import {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Pressable} from './ActionPressable';
import {Text} from './ResponsiveText';
import {FilterSection} from './FilterSection';
import {useTheme} from './AppTheme';
import {groupListingSources, listingSourceLabel, type ListingSourceOption} from '../lib/listing-sources';

type Props = {options: readonly ListingSourceOption[]; selected: readonly string[]; onChange: (ids: string[]) => void};
const channelWord = (count: number) => count%100>=11&&count%100<=14?'каналов':count%10===1?'канал':count%10>=2&&count%10<=4?'канала':'каналов';

export function ListingSourceFilter({options, selected, onChange}: Props) {
  const {theme} = useTheme();
  const {direct, groups} = useMemo(() => groupListingSources([
    ...options,
    ...selected.filter(id => !options.some(option => option.id === id)).map(id => ({id,label:listingSourceLabel(id),count:0})),
  ]), [options, selected]);
  const summary = selected.length === 0 ? 'Все источники' : selected.length === 1 ? listingSourceLabel(selected[0]) : `Выбрано каналов и источников: ${selected.length}`;
  function optionButton(option: ListingSourceOption) {
    const active = selected.includes(option.id);
    return <Pressable key={option.id} accessibilityRole="button" accessibilityLabel={`${option.label}, ${option.count} объявлений`} accessibilityState={{selected:active}}
      onPress={() => onChange(active ? selected.filter(id => id !== option.id) : [...selected, option.id])}
      style={[styles.option,{borderColor:active?theme.accent:theme.border,backgroundColor:active?theme.accentSurface:theme.surface}]}>
      <Text style={{color:active?theme.accent:theme.muted,fontSize:13,fontWeight:'800',lineHeight:19}}>{active?'✓ ':''}{option.label} · {option.count}</Text>
    </Pressable>;
  }
  return <FilterSection title="Источники объявлений" summary={summary}>
    <Text style={[styles.hint,{color:theme.muted}]}>Можно выбрать источник целиком или отдельные региональные каналы.</Text>
    <View style={styles.options}>
      <Pressable accessibilityRole="button" accessibilityLabel="Все источники" accessibilityState={{selected:selected.length===0}} onPress={()=>onChange([])}
        style={[styles.option,{borderColor:selected.length===0?theme.accent:theme.border,backgroundColor:selected.length===0?theme.accentSurface:theme.surface}]}>
        <Text style={{color:selected.length===0?theme.accent:theme.muted,fontSize:13,fontWeight:'800'}}>Все источники</Text>
      </Pressable>
      {direct.map(optionButton)}
    </View>
    <View style={styles.groups}>
      {groups.map(group => {
        const ids = group.channels.map(channel=>channel.id);
        const selectedCount = ids.filter(id=>selected.includes(id)).length;
        const allSelected = selectedCount === ids.length;
        return <View key={group.id} style={[styles.group,{borderColor:theme.border}]}>
          <FilterSection title={group.label} summary={`${group.channels.length} ${channelWord(group.channels.length)} · ${group.count} объявлений${selectedCount?` · выбрано: ${selectedCount}`:''}`}>
            <View style={styles.options}>
              {ids.length>1&&<Pressable accessibilityRole="button" accessibilityLabel={`Все каналы источника ${group.label}`} accessibilityState={{selected:allSelected}}
                onPress={()=>onChange(allSelected?selected.filter(id=>!ids.includes(id)):[...new Set([...selected,...ids])])}
                style={[styles.option,{borderColor:allSelected?theme.accent:theme.border,backgroundColor:allSelected?theme.accentSurface:theme.surface}]}>
                <Text style={{color:allSelected?theme.accent:theme.muted,fontSize:13,fontWeight:'800'}}>{allSelected?'✓ ':''}Все каналы источника · {group.count}</Text>
              </Pressable>}
              {group.channels.map(optionButton)}
            </View>
          </FilterSection>
        </View>;
      })}
    </View>
  </FilterSection>;
}

const styles = StyleSheet.create({
  hint:{fontSize:13,lineHeight:19,marginTop:4,marginBottom:10},
  options:{flexDirection:'row',flexWrap:'wrap',gap:8,paddingBottom:4},
  option:{borderWidth:1,borderRadius:16,paddingHorizontal:12,paddingVertical:10,minHeight:40,justifyContent:'center'},
  groups:{gap:8,marginTop:8},
  group:{borderWidth:1,borderRadius:14,paddingHorizontal:12,paddingVertical:6},
});
