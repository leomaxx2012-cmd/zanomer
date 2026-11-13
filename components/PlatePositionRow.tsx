import { View } from 'react-native';
import { Pressable } from './ActionPressable';
import { Text } from './ResponsiveText';
import { useTheme } from './AppTheme';
import { movePlatePosition, platePositions, type PlatePosition, type PlateVehicle } from '../lib/plate-editing';

export function PlatePositionRow({ vehicle, values, position, onSelect }: {
  vehicle: PlateVehicle; values: { left: string; digits: string; right: string };
  position: PlatePosition; onSelect: (position: PlatePosition) => void;
}) {
  const { theme } = useTheme();
  const positions = platePositions(vehicle);
  const selected = positions.findIndex(item => item.section === position.section && item.index === position.index);
  const arrow = (direction: -1 | 1, disabled: boolean) => <Pressable
    accessibilityRole="button" accessibilityLabel={direction === -1 ? 'Предыдущий символ номера' : 'Следующий символ номера'}
    accessibilityState={{ disabled }} disabled={disabled} onPress={() => onSelect(movePlatePosition(vehicle, position, direction))}
    style={{ width: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: theme.border, opacity: disabled ? 0.3 : 1 }}>
    <Text style={{ color: theme.accent, fontSize: 24 }}>{direction === -1 ? '‹' : '›'}</Text>
  </Pressable>;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
    {arrow(-1, selected <= 0)}
    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 3 }}>
      {positions.map((item, index) => <Pressable key={`${item.section}:${item.index}`} accessibilityRole="button"
        accessibilityLabel={`Символ номера ${index + 1}`} accessibilityState={{ selected: index === selected }}
        onPress={() => onSelect(item)} style={{ flex: 1, maxWidth: 45, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center',
          borderWidth: index === selected ? 2 : 1, borderColor: index === selected ? theme.accent : theme.border,
          backgroundColor: index === selected ? theme.accentSurface : theme.surface, borderRadius: 8 }}>
        <Text allowFontScaling={false} style={{ color: index === selected ? theme.accent : theme.text, fontSize: 20, fontWeight: '800' }}>{values[item.section][item.index] || '*'}</Text>
      </Pressable>)}
    </View>
    {arrow(1, selected >= positions.length - 1)}
  </View>;
}
