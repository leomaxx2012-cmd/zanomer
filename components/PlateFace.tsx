import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

type Vehicle = "car" | "motorcycle" | "truck";
type PlateFaceProps = { leftLetter?: string; digits?: string; rightLetters?: string; region?: string; vehicle?: Vehicle };

export function PlateCountry({ scale = 1 }: { scale?: number }) {
  return <View style={[styles.country, { gap: 4 * scale }]}>
    <Text allowFontScaling={false} style={[styles.rus, { fontSize: 18 * scale, lineHeight: 21 * scale }]}>RUS</Text>
    <View style={[styles.flag, { width: 35 * scale, height: 20 * scale, borderWidth: 0.6 * scale }]}>
      <View style={styles.white} /><View style={styles.blue} /><View style={styles.red} />
    </View>
  </View>;
}

function Glyph({ value, left, top, width, size, scale }: { value: string; left: number; top: number; width: number; size: number; scale: number }) {
  return <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}
    style={[styles.glyph, { left: left * scale, top: top * scale, width: width * scale, fontSize: size * scale, lineHeight: size * 1.2 * scale }]}>{value}</Text>;
}

// One proportionally scaled face in every preview. "truck" is the existing trailer category.
function PlateFaceContent({ leftLetter = "", digits = "", rightLetters = "", region = "", vehicle = "car" }: PlateFaceProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const moto = vehicle === "motorcycle";
  const base = moto ? { width: 288, height: 216 } : { width: 520, height: 112 };
  const scale = Math.min(size.width / base.width, size.height / base.height);
  const label = moto ? `Мотоцикл: ${digits} ${rightLetters}, регион ${region}` : vehicle === "truck" ? `Прицеп: ${leftLetter} ${digits}, регион ${region}` : `${leftLetter} ${digits} ${rightLetters}, регион ${region}`;
  return <View accessible accessibilityLabel={label} style={styles.container}
    onLayout={({ nativeEvent: { layout } }) => setSize(old => old.width === layout.width && old.height === layout.height ? old : { width: layout.width, height: layout.height })}>
    {scale > 0 && <View style={{ width: base.width * scale, height: base.height * scale }}>
      <View style={[styles.frame, { borderWidth: 2.6 * scale, borderRadius: 11 * scale }]} />
      {moto ? <>
        <Glyph value={digits} left={28} top={-8} width={232} size={106} scale={scale} />
        <Glyph value={rightLetters} left={18} top={112} width={128} size={94} scale={scale} />
        <View style={[styles.divider, { left: 153 * scale, top: 139 * scale, width: 2.5 * scale, bottom: 2 * scale }]} />
        <Glyph value={region} left={165} top={127} width={111} size={region.length > 2 ? 76 : 86} scale={scale} />
        <View style={{ position: "absolute", left: 151 * scale, top: 112 * scale }}><PlateCountry scale={1.25 * scale} /></View>
        <View style={[styles.motoNotch, { right: 2 * scale, top: 123 * scale, width: 20 * scale, height: 2.6 * scale }]} />
      </> : <>
        {vehicle === "truck" ? <>
          <Glyph value={leftLetter} left={24} top={23} width={100} size={74} scale={scale} />
          <Glyph value={digits} left={133} top={-8} width={246} size={100} scale={scale} />
        </> : <>
          <Glyph value={leftLetter} left={24} top={23} width={49} size={74} scale={scale} />
          <Glyph value={digits} left={81} top={-8} width={174} size={100} scale={scale} />
          <Glyph value={rightLetters} left={263} top={23} width={116} size={74} scale={scale} />
        </>}
        <View style={[styles.divider, { left: 394 * scale, top: 2 * scale, bottom: 2 * scale, width: 2.6 * scale }]} />
        <Glyph value={region} left={402} top={-8} width={110} size={region.length > 2 ? 78 : 86} scale={scale} />
        <View style={{ position: "absolute", left: 405 * scale, top: 82 * scale }}><PlateCountry scale={scale} /></View>
        <View style={[styles.bolt, { left: 13 * scale, top: 56 * scale, width: 3.5 * scale, height: 3.5 * scale }]} />
        <View style={[styles.bolt, { right: 13 * scale, top: 56 * scale, width: 3.5 * scale, height: 3.5 * scale }]} />
      </>}
    </View>}
  </View>;
}

export const PlateFace = memo(PlateFaceContent);

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1, justifyContent: "center", overflow: "hidden" },
  frame: { ...StyleSheet.absoluteFillObject, borderColor: "#080808", backgroundColor: "#FAFAFA" },
  glyph: { color: "#080808", fontFamily: "PlateNumber", fontWeight: "400", includeFontPadding: false, position: "absolute", textAlign: "center" },
  divider: { backgroundColor: "#080808", position: "absolute" },
  country: { alignItems: "center", flexDirection: "row", justifyContent: "center" },
  rus: { color: "#080808", fontWeight: "400", includeFontPadding: false },
  flag: { borderColor: "#333333", overflow: "hidden" },
  white: { backgroundColor: "#FFFFFF", flex: 1 }, blue: { backgroundColor: "#0055A4", flex: 1 }, red: { backgroundColor: "#EF1C25", flex: 1 },
  bolt: { backgroundColor: "#303030", borderRadius: 99, position: "absolute" },
  motoNotch: { backgroundColor: "#080808", position: "absolute" },
});
