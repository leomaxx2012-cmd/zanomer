import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

type Vehicle = "car" | "motorcycle" | "truck";
type PlateFaceProps = { leftLetter?: string; digits?: string; rightLetters?: string; region?: string; vehicle?: Vehicle };

function Flag({ scale }: { scale: number }) {
  return <View style={[styles.flag, { width: 34 * scale, height: 18 * scale }]}><View style={styles.white} /><View style={styles.blue} /><View style={styles.red} /></View>;
}

function Glyph({ value, left, top, width, size, scale }: { value: string; left: number; top: number; width: number; size: number; scale: number }) {
  return <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.48} style={[styles.glyph, { left: left * scale, top: top * scale, width: width * scale, fontSize: size * scale, lineHeight: size * scale }]}>{value}</Text>;
}

// Мото: четыре цифры над двумя буквами. Прицеп: две буквы и четыре цифры.
export function PlateFace({ leftLetter = "", digits = "", rightLetters = "", region = "", vehicle = "car" }: PlateFaceProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const base = vehicle === "motorcycle" ? { width: 300, height: 170 } : vehicle === "truck" ? { width: 500, height: 126 } : { width: 520, height: 112 };
  const scale = Math.min(size.width / base.width, size.height / base.height);
  const label = vehicle === "motorcycle" ? `Мотоцикл: ${digits} ${rightLetters}, регион ${region}` : vehicle === "truck" ? `Прицеп: ${leftLetter} ${digits}, регион ${region}` : `${leftLetter} ${digits} ${rightLetters}, регион ${region}`;
  return <View accessible accessibilityLabel={label} style={styles.container} onLayout={({ nativeEvent: { layout } }) => setSize((old) => old.width === layout.width && old.height === layout.height ? old : { width: layout.width, height: layout.height })}>
    {scale > 0 && <View style={{ width: base.width * scale, height: base.height * scale }}>
      {vehicle === "car" && <>
        <Glyph value={leftLetter} left={12} top={26} width={72} size={68} scale={scale} /><Glyph value={digits} left={84} top={0} width={180} size={94} scale={scale} /><Glyph value={rightLetters} left={264} top={26} width={122} size={68} scale={scale} /><View style={[styles.divider, { left: 390 * scale }]} />
        <Glyph value={region} left={396} top={7} width={118} size={region.length > 2 ? 58 : 68} scale={scale} /><View style={[styles.meta, { left: 396 * scale, top: 79 * scale, width: 118 * scale, gap: 5 * scale }]}><Text allowFontScaling={false} style={[styles.rus, { fontSize: 13 * scale }]}>RUS</Text><Flag scale={scale} /></View>
      </>}
      {vehicle === "motorcycle" && <>
        <Glyph value={digits} left={12} top={2} width={188} size={74} scale={scale} /><Glyph value={rightLetters} left={18} top={79} width={112} size={50} scale={scale} /><View style={[styles.divider, { left: 205 * scale }]} />
        <Glyph value={region} left={214} top={25} width={78} size={region.length > 2 ? 42 : 52} scale={scale} /><View style={[styles.metaColumn, { left: 218 * scale, top: 86 * scale, width: 70 * scale }]}><Text allowFontScaling={false} style={[styles.rus, { fontSize: 11 * scale }]}>RUS</Text><Flag scale={scale} /></View>
      </>}
      {vehicle === "truck" && <>
        <Glyph value={leftLetter} left={14} top={28} width={110} size={66} scale={scale} /><Glyph value={digits} left={118} top={13} width={214} size={82} scale={scale} /><View style={[styles.divider, { left: 342 * scale }]} />
        <Glyph value={region} left={351} top={13} width={136} size={region.length > 2 ? 56 : 64} scale={scale} /><View style={[styles.meta, { left: 355 * scale, top: 90 * scale, width: 126 * scale, gap: 5 * scale }]}><Text allowFontScaling={false} style={[styles.rus, { fontSize: 13 * scale }]}>RUS</Text><Flag scale={scale} /></View>
      </>}
      <View style={[styles.bolt, { left: 5 * scale, width: 5 * scale, height: 5 * scale }]} /><View style={[styles.bolt, { right: 5 * scale, width: 5 * scale, height: 5 * scale }]} />
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1, justifyContent: "center", overflow: "hidden" },
  glyph: { color: "#121722", fontFamily: Platform.select({ android: "sans-serif", web: "Arial", default: "System" }), fontWeight: "700", includeFontPadding: false, position: "absolute", textAlign: "center" },
  divider: { borderLeftColor: "#131B2A", borderLeftWidth: 2, bottom: 0, position: "absolute", top: 0 },
  meta: { alignItems: "center", flexDirection: "row", justifyContent: "center", position: "absolute" }, metaColumn: { alignItems: "center", gap: 3, position: "absolute" }, rus: { color: "#111827", fontWeight: "900", includeFontPadding: false },
  flag: { borderColor: "#667085", borderWidth: 0.7, overflow: "hidden" }, white: { backgroundColor: "#FFFFFF", flex: 1 }, blue: { backgroundColor: "#2455A6", flex: 1 }, red: { backgroundColor: "#D52B1E", flex: 1 }, bolt: { backgroundColor: "#1B2430", borderRadius: 99, position: "absolute", top: "50%" },
});
