import { Children, isValidElement, forwardRef, type ReactNode } from 'react';
import { markBackdropControlTouch } from '../lib/backdrop-touch';
import { buttonOutlineColor } from '../lib/button-outline';
import { useTheme } from './AppTheme';
import { Platform, Pressable as NativePressable, StyleSheet, View, type PressableProps, type TextStyle, type ViewStyle } from 'react-native';

function contentTint(children: ReactNode): unknown {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{style?: TextStyle | TextStyle[]; children?: ReactNode}>(child)) continue;
    const color = StyleSheet.flatten(child.props.style)?.color;
    if (color) return color;
    const nested = contentTint(child.props.children);
    if (nested) return nested;
  }
}

// Keep the existing hit areas, callbacks, disabled states and test IDs.
// Transparent modal dismiss layers and plate hit areas must never move.
export const Pressable = forwardRef<View, PressableProps & { outlined?: boolean }>(function ActionPressable({style, disabled, outlined = true, ...props}, ref) {
  const {theme,mode} = useTheme();
  const sample = typeof style === 'function' ? style({pressed:false, hovered:false}) : style;
  const flat = StyleSheet.flatten(sample);
  const motion = !disabled && flat?.position !== 'absolute';
  // Keep touch propagation and callbacks, without triggering the page's glow.
  const webProps = Platform.OS === 'web' ? {dataSet:{motion:motion?'button':'none'}} : {};
  const tint = typeof props.children === 'function' ? undefined : contentTint(props.children);
  const outline = (surface: ViewStyle = {}): ViewStyle | undefined => {
    const panel = typeof surface.maxWidth === 'number' && surface.maxWidth >= 360 && typeof surface.width === 'string' && typeof surface.padding === 'number' && surface.padding >= 16;
    if (!outlined || surface.position === 'absolute' || surface.aspectRatio != null || panel || (surface.flex === 1 && surface.borderRadius == null) || props.accessibilityRole === 'link') return;
    return { borderWidth: Math.max(1.25, typeof surface.borderWidth === 'number' ? surface.borderWidth : 0), borderColor: buttonOutlineColor(surface.backgroundColor, tint, surface.borderColor, theme, mode === 'dark'), borderRadius: surface.borderRadius ?? 8 };
  };
  return <NativePressable {...props} {...webProps} ref={ref} disabled={disabled}
    onTouchStart={event => { markBackdropControlTouch(event.nativeEvent); props.onTouchStart?.(event); }}
    style={state => { const current = typeof style === 'function' ? style(state) : style; return [current, outline(StyleSheet.flatten(current))]; }} />;
});
