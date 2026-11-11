import { forwardRef } from 'react';
import { markBackdropControlTouch } from '../lib/backdrop-touch';
import { Platform, Pressable as NativePressable, StyleSheet, View, type PressableProps } from 'react-native';

// Keep the existing hit areas, callbacks, disabled states and test IDs.
// Transparent modal dismiss layers and plate hit areas must never move.
export const Pressable = forwardRef<View, PressableProps>(function ActionPressable({style, disabled, ...props}, ref) {
  const sample = typeof style === 'function' ? style({pressed:false}) : style;
  const flat = StyleSheet.flatten(sample);
  const motion = !disabled && flat?.position !== 'absolute';
  // Keep touch propagation and callbacks, without triggering the page's glow.
  const webProps = Platform.OS === 'web' ? {dataSet:{motion:motion?'button':'none'}} : {};
  return <NativePressable {...props} {...webProps} ref={ref} disabled={disabled}
    onTouchStart={event => { markBackdropControlTouch(event.nativeEvent); props.onTouchStart?.(event); }}
    style={style} />;
});
