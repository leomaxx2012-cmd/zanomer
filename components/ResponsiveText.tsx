import { createContext, forwardRef, useContext, useMemo, type PropsWithChildren } from "react";
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, useWindowDimensions, type TextProps, type TextInputProps, type TextStyle } from "react-native";

const TypographyScale = createContext(1);

export function ResponsiveTypography({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  // One subscription for the whole screen; no per-label layout measurements.
  // Small phones retain readable body text; tablet text grows only slightly.
  const scale = Math.max(0.88, Math.min(1.08, width / 360));
  return <TypographyScale.Provider value={scale}>{children}</TypographyScale.Provider>;
}

function scaledStyle(style: TextProps["style"], scale: number): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const fontSize = flat.fontSize;
  if (typeof fontSize !== "number") return {};
  const fitted = Math.max(Math.min(fontSize, 12), fontSize * scale);
  return {
    fontSize: fitted,
    ...(typeof flat.lineHeight === "number" ? { lineHeight: flat.lineHeight * fitted / fontSize } : {}),
  };
}

type ResponsiveTextProps = TextProps & { responsive?: boolean };
export function Text({ style, responsive = true, ...props }: ResponsiveTextProps) {
  const scale = useContext(TypographyScale);
  const sizing = useMemo(() => responsive ? scaledStyle(style, scale) : {}, [style, scale, responsive]);
  return <NativeText maxFontSizeMultiplier={1.3}
    adjustsFontSizeToFit={props.numberOfLines != null}
    minimumFontScale={0.8}
    {...props} style={[styles.text, style, sizing]} />;
}

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  const scale = useContext(TypographyScale);
  const sizing = useMemo(() => scaledStyle(style, scale), [style, scale]);
  return <NativeTextInput ref={ref} maxFontSizeMultiplier={1.3} {...props} style={[styles.input, style, sizing]} />;
});

const styles = StyleSheet.create({
  text: { minWidth: 0, maxWidth: "100%", flexShrink: 1 },
  input: { minWidth: 0, maxWidth: "100%", flexShrink: 1 },
});
