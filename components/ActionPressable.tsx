import { forwardRef } from 'react';
import { Platform, Pressable as NativePressable, StyleSheet, View, type PressableProps } from 'react-native';

// Keep the existing hit areas, callbacks, disabled states and test IDs.
// Transparent modal dismiss layers and plate hit areas must never move.
export const Pressable = forwardRef<View, PressableProps>(function ActionPressable({style, disabled, ...props}, ref) {
  const sample = typeof style === 'function' ? style({pressed:false, hovered:false}) : style;
  const flat = StyleSheet.flatten(sample);
  const motion = !disabled && flat?.position !== 'absolute';
  const webProps = Platform.OS === 'web' ? {dataSet:{motion:motion?'button':'none'}} : {};
  return <NativePressable {...props} {...webProps} ref={ref} disabled={disabled}
    style={state => [typeof style === 'function' ? style(state) : style,
      Platform.OS !== 'web' && motion && state.pressed && {opacity:0.78}]} />;
});
