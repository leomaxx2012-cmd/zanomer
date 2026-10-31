import { forwardRef } from 'react';
import { Platform, Pressable as NativePressable, StyleSheet, View, type PressableProps } from 'react-native';

// Keep the existing hit areas, callbacks, disabled states and test IDs.
// Transparent modal dismiss layers and plate hit areas must never move.
export const Pressable = forwardRef<View, PressableProps>(function ActionPressable({style, disabled, ...props}, ref) {
  const sample = typeof style === 'function' ? style({pressed:false, hovered:false}) : style;
  const flat = StyleSheet.flatten(sample);
  const motion = !disabled && flat?.position !== 'absolute';
  // A modal surface also uses Pressable to stop outside taps. Applying
  // opacity to it fades the entire window, including its opaque children.
  // Android ripple belongs only to bounded controls, never those surfaces.
  const controlHeight = flat?.height ?? flat?.minHeight;
  const boundedControl = motion && flat?.flex !== 1 && typeof controlHeight === 'number' && controlHeight > 0 && controlHeight <= 80;
  const webProps = Platform.OS === 'web' ? {dataSet:{motion:motion?'button':'none'}} : {};
  return <NativePressable {...props} {...webProps} ref={ref} disabled={disabled}
    android_ripple={props.android_ripple ?? (Platform.OS === 'android' && boundedControl ? {color:'#5143C224'} : undefined)}
    style={style} />;
});
