import { useState } from 'react';
import { View } from 'react-native';
import { Pressable } from './ActionPressable';
import { Text } from './ResponsiveText';
import { useTheme } from './AppTheme';

export function RegionCodeEntry({ onApply, initialValue = '', actionLabel = 'Добавить код' }: {
  onApply: (code: string) => void; initialValue?: string; actionLabel?: string;
}) {
  const { theme } = useTheme();
  const [value, setValue] = useState(/^\d{2,3}$/.test(initialValue) ? initialValue : '');
  const [position, setPosition] = useState(0);
  const [open, setOpen] = useState(false);
  const valid = /^\d{2,3}$/.test(value) && Number(value) > 0;
  const write = (character: string) => {
    const characters = value.padEnd(3, ' ').split('');
    characters[position] = character;
    setValue(characters.join('').trimEnd());
    setPosition(index => Math.min(2, index + 1));
  };
  const erase = () => {
    const index = value[position]?.trim() ? position : Math.max(0, position - 1);
    const characters = value.padEnd(3, ' ').split('');
    characters[index] = ' ';
    setValue(characters.join('').trimEnd());
    setPosition(index);
  };
  const button = { minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 9, borderWidth: 1, borderColor: theme.border };
  return <View style={{ gap: 8, padding: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 12 }}>
    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>Код региона цифрами</Text>
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      {[0, 1, 2].map(index => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Цифра региона ${index + 1}`}
        accessibilityValue={{ text: value[index]?.trim() || 'пусто' }} accessibilityState={{ selected: open && index === position }}
        onPress={() => { setPosition(index); setOpen(true); }} style={[button, { width: 44, height: 44, borderRadius: 6,
          borderWidth: open && index === position ? 2 : 1, borderColor: open && index === position ? theme.accent : theme.border,
          backgroundColor: open && index === position ? theme.accentSurface : theme.surface }]}>
        <Text allowFontScaling={false} style={{ color: open && index === position ? theme.accent : theme.text, fontSize: 22, fontWeight: '800' }}>{value[index]?.trim() || '—'}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Очистить код региона" onPress={() => { setValue(''); setPosition(0); }} style={[button, { width: 44, marginLeft: 'auto' }]}>
        <Text style={{ color: theme.muted, fontSize: 24 }}>×</Text>
      </Pressable>
    </View>
    {open && <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {['1','2','3','4','5','6','7','8','9','0'].map(digit => <Pressable key={digit} accessibilityRole="button" accessibilityLabel={`Ввести цифру региона ${digit}`}
          onPress={() => write(digit)} style={[button, { width: '22%', flexGrow: 1, backgroundColor: theme.surface }]}>
          <Text style={{ color: theme.accent, fontSize: 18, fontWeight: '800' }}>{digit}</Text>
        </Pressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel="Удалить выбранную цифру региона" onPress={erase} style={[button, { width: '22%', flexGrow: 1 }]}><Text style={{ color: theme.accent, fontSize: 20 }}>⌫</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Скрыть клавиатуру региона" onPress={() => setOpen(false)} style={[button, { width: '22%', flexGrow: 1 }]}><Text style={{ color: theme.muted, fontSize: 22 }}>×</Text></Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} disabled={!valid} accessibilityState={{ disabled: !valid }}
        onPress={() => { if (valid) { onApply(value); setOpen(false); } }} style={[button, { backgroundColor: '#5143C2', opacity: valid ? 1 : 0.4 }]}>
        <Text style={{ color: theme.onPrimary, fontWeight: '800' }}>{actionLabel}</Text>
      </Pressable>
    </>}
    <Text style={{ color: theme.muted, fontSize: 11 }}>Нажми на поле и введи 2 или 3 цифры.</Text>
  </View>;
}
