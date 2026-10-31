import { memo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { plateArtwork, plateGlyphs } from "../lib/plate-artwork";

type Vehicle = "car" | "motorcycle" | "truck";
type PlateFaceProps = { leftLetter?: string; digits?: string; rightLetters?: string; region?: string; vehicle?: Vehicle };
const latin: Record<string, string> = { A: "А", B: "В", E: "Е", K: "К", M: "М", H: "Н", O: "О", P: "Р", C: "С", T: "Т", Y: "У", X: "Х" };
const star = require("../assets/plates/star.png");
const dash = require("../assets/plates/dash.png");

// Frames, ink outlines and anchors share the reference's native coordinate space.
// Scaling the whole artwork preserves the exact baselines, spacing and both frames.
function PlateFaceContent({ leftLetter = "", digits = "", rightLetters = "", region = "", vehicle = "car" }: PlateFaceProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const moto = vehicle === "motorcycle";
  const three = /^\d{3}$/.test(region);
  const frameInset = 5;
  const artwork = moto ? plateArtwork.motorcycle : vehicle === "truck" && !three ? plateArtwork.trailer : three ? plateArtwork.car3 : plateArtwork.car2;
  const scale = Math.min(size.width / artwork.width, size.height / artwork.height);
  const letters = (moto ? rightLetters : vehicle === "truck" ? leftLetter : leftLetter + rightLetters).toUpperCase();
  const plainRegion = /^\d{2,3}$/.test(region);
  const label = moto ? `Мотоцикл: ${digits} ${rightLetters}, регион ${region}` : vehicle === "truck" ? `Прицеп: ${leftLetter} ${digits}, регион ${region}` : `${leftLetter} ${digits} ${rightLetters}, регион ${region}`;
  let slots = artwork.slots;
  // Three-digit regions retain a separate region frame without narrowing the whole sign.
  if (vehicle === "truck" && three) {
    slots = [
      ...plateArtwork.trailer.slots.filter(s => s.group !== "region2").map(s => ({ ...s, x: 45 + (s.x - 45) * 0.92 })),
      ...plateArtwork.car3.slots.filter(s => s.group === "region3"),
    ];
  }
  if (moto && three) {
    slots = [...plateArtwork.motorcycle.slots.filter(s => s.group !== "motoRegion"), ...[0, 1, 2].map(index => ({ group: "motoRegion", index, x: 211 + index * 51, y: 175 }))];
  }
  return <View accessible accessibilityLabel={label} style={styles.container} onLayout={({ nativeEvent: { layout } }) => setSize(old => old.width === layout.width && old.height === layout.height ? old : { width: layout.width, height: layout.height })}>
    {/* Clip the white rectangular image margin outside the rounded metal frame. */}
    {scale > 0 && <View style={{ width: (artwork.width - frameInset * 2) * scale, height: (artwork.height - frameInset * 2) * scale, borderRadius: 15 * scale, overflow: "hidden" }}>
      <View style={{ width: artwork.width * scale, height: artwork.height * scale, marginLeft: -frameInset * scale, marginTop: -frameInset * scale }}>
      <Image accessible={false} source={artwork.image} resizeMode="stretch" style={{ position: "absolute", left: 0, top: 0, width: artwork.width * scale, height: artwork.height * scale }} />
      {slots.map((slot, index) => {
        const isRegion = slot.group === "region2" || slot.group === "region3" || slot.group === "motoRegion";
        if (isRegion && !plainRegion) return null;
        const value = slot.group === "letters" ? letters : isRegion ? region : digits;
        const character = value[slot.index] ?? "";
        if (!character) return null;
        const glyph = plateGlyphs[slot.group]?.[latin[character] ?? character];
        const horizontal = vehicle === "truck" && three && !isRegion ? 0.92 : moto && three && isRegion ? 0.88 : 1;
        if (!glyph) return <Image key={index} accessible={false} source={character === "—" ? dash : star} resizeMode="contain" style={{ position: "absolute", left: (slot.x + 12) * scale, top: (slot.y + 18) * scale, width: 32 * scale, height: 32 * scale }} />;
        return <Image key={index} accessible={false} source={glyph.image} resizeMode="stretch" style={{ position: "absolute", left: (slot.x + glyph.dx * horizontal) * scale, top: (slot.y + glyph.dy) * scale, width: glyph.width * horizontal * scale, height: glyph.height * scale }} />;
      })}
      {!plainRegion && <View style={{ position: "absolute", left: (moto ? 215 : three ? 584 : 630) * scale, top: (moto ? 175 : 21) * scale, width: (moto ? 135 : three ? 180 : 135) * scale, height: 89 * scale, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {region === "*" || region === "—" || !region ? <Image accessible={false} source={region === "—" ? dash : star} resizeMode="contain" style={{ width: 42 * scale, height: 32 * scale }} /> : <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.3} style={{ color: "#111", width: "100%", textAlign: "center", fontSize: 28 * scale }}>{region}</Text>}
      </View>}
      </View>
    </View>}
  </View>;
}
export const PlateFace = memo(PlateFaceContent);
const styles = StyleSheet.create({ container: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" } });
