import { memo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import glyphRatios from "../assets/plates/ratios.json";

type Vehicle = "car" | "motorcycle" | "truck";
type PlateFaceProps = { leftLetter?: string; digits?: string; rightLetters?: string; region?: string; vehicle?: Vehicle };

const glyphs: Record<string, number> = {
  "0": require("../assets/plates/0030.png"), "1": require("../assets/plates/0031.png"),
  "2": require("../assets/plates/0032.png"), "3": require("../assets/plates/0033.png"),
  "4": require("../assets/plates/0034.png"), "5": require("../assets/plates/0035.png"),
  "6": require("../assets/plates/0036.png"), "7": require("../assets/plates/0037.png"),
  "8": require("../assets/plates/0038.png"), "9": require("../assets/plates/0039.png"),
  "А": require("../assets/plates/0410.png"), "В": require("../assets/plates/0412.png"),
  "Е": require("../assets/plates/0415.png"), "К": require("../assets/plates/041a.png"),
  "М": require("../assets/plates/041c.png"), "Н": require("../assets/plates/041d.png"),
  "О": require("../assets/plates/041e.png"), "Р": require("../assets/plates/0420.png"),
  "С": require("../assets/plates/0421.png"), "Т": require("../assets/plates/0422.png"),
  "У": require("../assets/plates/0423.png"), "Х": require("../assets/plates/0425.png"),
  "*": require("../assets/plates/star.png"), "—": require("../assets/plates/dash.png"),
};
const latin: Record<string, string> = { A: "А", B: "В", E: "Е", K: "К", M: "М", H: "Н", O: "О", P: "Р", C: "С", T: "Т", Y: "У", X: "Х" };

// Images use the actual ink bounds: system font metrics cannot move or clip them.
function GlyphRun({ value, x, y, width, height, gap, scale, packed = false }: { value: string; x: number; y: number; width: number; height: number; gap: number; scale: number; packed?: boolean }) {
  const chars = Array.from(value.toUpperCase());
  const known = chars.every(char => glyphs[latin[char] ?? char] != null);
  return <View style={{ position: "absolute", left: x * scale, top: y * scale, width: width * scale, height: height * scale, flexDirection: "row", gap: gap * scale, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
    {known ? chars.map((char, index) => {
      const normalized = latin[char] ?? char;
      const inkHeight = char === "*" ? Math.min(height, 32) : height;
      const ratio = (glyphRatios as Record<string, number>)[normalized] ?? 1;
      const inkWidth = Math.min((width - gap * (chars.length - 1)) / chars.length, inkHeight * ratio * (/^[0-9]$/.test(char) ? 0.86 : char === "*" ? 1 : 0.83));
      return <View key={index} style={{ flex: packed ? undefined : 1, width: packed ? inkWidth * scale : undefined, minWidth: 0, height: height * scale, alignItems: "center", justifyContent: "center" }}><Image accessible={false} source={glyphs[normalized]} resizeMode="stretch" style={{ width: inkWidth * scale, height: inkHeight * scale }} /></View>;
    }) :
      <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.25} style={{ width: "100%", textAlign: "center", color: "#111", fontSize: Math.min(height, width / Math.max(1, chars.length)) * scale }}>{value}</Text>}
  </View>;
}

function Country({ x, y, scale, large = false }: { x: number; y: number; scale: number; large?: boolean }) {
  const countryScale = (large ? 1.15 : 1) * scale;
  return <View style={{ position: "absolute", left: x * scale, top: y * scale, flexDirection: "row", alignItems: "center", gap: 4 * countryScale }}>
    <Text allowFontScaling={false} style={{ color: "#111", fontSize: 18 * countryScale, lineHeight: 22 * countryScale, fontWeight: "400", includeFontPadding: false }}>RUS</Text>
    <View style={{ width: 35 * countryScale, height: 19 * countryScale, borderWidth: 0.6 * countryScale, borderColor: "#444", overflow: "hidden" }}>
      <View style={{ flex: 1, backgroundColor: "#fff" }} /><View style={{ flex: 1, backgroundColor: "#0055a4" }} /><View style={{ flex: 1, backgroundColor: "#ef1c25" }} />
    </View>
  </View>;
}

function PlateFaceContent({ leftLetter = "", digits = "", rightLetters = "", region = "", vehicle = "car" }: PlateFaceProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const moto = vehicle === "motorcycle";
  const base = moto ? { width: 288, height: 216 } : { width: 520, height: 112 };
  const scale = Math.min(size.width / base.width, size.height / base.height);
  const label = moto ? `Мотоцикл: ${digits} ${rightLetters}, регион ${region}` : vehicle === "truck" ? `Прицеп: ${leftLetter} ${digits}, регион ${region}` : `${leftLetter} ${digits} ${rightLetters}, регион ${region}`;
  const threeDigitRegion = region.length === 3;
  const divider = threeDigitRegion ? 386 : 397;
  return <View accessible accessibilityLabel={label} style={styles.container} onLayout={({ nativeEvent: { layout } }) => setSize(old => old.width === layout.width && old.height === layout.height ? old : { width: layout.width, height: layout.height })}>
    {scale > 0 && <View style={{ width: base.width * scale, height: base.height * scale, overflow: "hidden", borderRadius: 10 * scale }}>
      <View style={[styles.frame, { borderWidth: 3 * scale, borderRadius: 10 * scale }]} />
      <View pointerEvents="none" style={{ position: "absolute", left: 4.2 * scale, right: 4.2 * scale, top: 4.2 * scale, bottom: 4.2 * scale, borderWidth: 1.1 * scale, borderColor: "#D1D1D1", borderRadius: 6.5 * scale }} />
      {moto ? <>
        <GlyphRun value={digits} x={36} y={20} width={216} height={68} gap={8} scale={scale} />
        <GlyphRun value={rightLetters} x={25} y={139} width={112} height={64} gap={10} scale={scale} />
        <View style={[styles.divider, { left: 153 * scale, top: 139 * scale, bottom: 3 * scale, width: 2.5 * scale }]} />
        <GlyphRun value={region} x={164} y={140} width={110} height={62} gap={5} scale={scale} packed={/^\d{2}$/.test(region)} />
        <Country x={152} y={103} scale={scale} large />
        <View style={[styles.divider, { right: 2 * scale, top: 119 * scale, width: 22 * scale, height: 3 * scale, borderRadius: 2 * scale }]} />
      </> : <>
        {vehicle === "truck" ? <>
          <GlyphRun value={leftLetter} x={36} y={35} width={106} height={58} gap={10} scale={scale} />
          <GlyphRun value={digits} x={155} y={18} width={222} height={76} gap={8} scale={scale} />
        </> : <>
          <GlyphRun value={leftLetter} x={36} y={35} width={50} height={58} gap={0} scale={scale} />
          <GlyphRun value={digits} x={98} y={18} width={168} height={76} gap={8} scale={scale} />
          <GlyphRun value={rightLetters} x={271} y={35} width={110} height={58} gap={9} scale={scale} />
        </>}
        <View style={[styles.divider, { left: divider * scale, top: 3 * scale, bottom: 3 * scale, width: 3 * scale }]} />
        <GlyphRun value={region} x={divider + 9} y={12} width={520 - divider - 19} height={58} gap={4} scale={scale} packed={/^\d{2}$/.test(region)} />
        <Country x={divider + 10} y={79} scale={scale} />
        <View style={[styles.bolt, { left: 17 * scale, top: 55 * scale, width: 3.5 * scale, height: 3.5 * scale }]} />
        <View style={[styles.bolt, { right: 16 * scale, top: 55 * scale, width: 3.5 * scale, height: 3.5 * scale }]} />
      </>}
    </View>}
  </View>;
}
export const PlateFace = memo(PlateFaceContent);
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  frame: { ...StyleSheet.absoluteFillObject, backgroundColor: "#F8F8F8", borderColor: "#090909" },
  divider: { position: "absolute", backgroundColor: "#090909" },
  bolt: { position: "absolute", backgroundColor: "#303030", borderRadius: 99 },
});
