import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

type PlateFaceProps = {
  leftLetter?: string;
  digits?: string;
  rightLetters?: string;
  region?: string;
};

// Scale every part together. Fixed font sizes inside percentage-width slots
// caused Android to wrap the third digit onto a clipped second line.
export function PlateFace({ leftLetter = "", digits = "", rightLetters = "", region = "" }: PlateFaceProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const scale = Math.min(size.width / 520, size.height / 112);
  const regionFontSize = region.length > 2 ? 58 : 68;
  const glyph = (value: string, left: number, top: number, width: number, fontSize: number) => (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.5}
      style={[styles.glyph, {
        left: left * scale, top: top * scale, width: width * scale,
        fontSize: fontSize * scale, lineHeight: fontSize * scale,
      }]}
    >{value}</Text>
  );

  return (
    <View
      accessible
      accessibilityLabel={`${leftLetter} ${digits} ${rightLetters}, регион ${region}`}
      style={styles.container}
      onLayout={({ nativeEvent: { layout } }) => setSize((previous) =>
        previous.width === layout.width && previous.height === layout.height
          ? previous : { width: layout.width, height: layout.height })}
    >
      {scale > 0 && <View style={{ width: 520 * scale, height: 112 * scale }}>
        {glyph(leftLetter, 12, 26, 72, 68)}
        {glyph(digits, 84, 0, 180, 94)}
        {glyph(rightLetters, 264, 26, 122, 68)}
        {glyph(region, 396, (94 - regionFontSize) * 0.2, 118, regionFontSize)}
        <View style={[styles.meta, { left: 396 * scale, top: 79 * scale, width: 118 * scale, gap: 5 * scale }]}>
          <Text allowFontScaling={false} style={[styles.rus, { fontSize: 13 * scale, lineHeight: 16 * scale }]}>RUS</Text>
          <View style={[styles.flag, { width: 38 * scale, height: 20 * scale }]}>
            <View style={styles.white} /><View style={styles.blue} /><View style={styles.red} />
          </View>
        </View>
      </View>}
      {scale > 0 && <>
        <View style={[styles.divider, { left: (size.width - 520 * scale) / 2 + 390 * scale }]} />
        <View style={[styles.bolt, { left: 5 * scale, width: 5 * scale, height: 5 * scale }]} />
        <View style={[styles.bolt, { right: 5 * scale, width: 5 * scale, height: 5 * scale }]} />
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  glyph: { position: "absolute", color: "#121722", fontFamily: Platform.select({ android: "sans-serif", web: "Arial", default: "System" }), fontWeight: "700", textAlign: "center", includeFontPadding: false },
  divider: { position: "absolute", top: 0, bottom: 0, borderLeftColor: "#131B2A", borderLeftWidth: 2 },
  meta: { position: "absolute", flexDirection: "row", alignItems: "center", justifyContent: "center" },
  rus: { color: "#111827", fontWeight: "900", includeFontPadding: false },
  flag: { borderColor: "#667085", borderWidth: 0.7, overflow: "hidden" },
  white: { backgroundColor: "#FFFFFF", flex: 1 },
  blue: { backgroundColor: "#2455A6", flex: 1 },
  red: { backgroundColor: "#D52B1E", flex: 1 },
  bolt: { position: "absolute", top: "50%", backgroundColor: "#1B2430", borderRadius: 99 },
});
