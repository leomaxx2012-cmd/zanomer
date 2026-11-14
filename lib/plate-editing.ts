type Section = "left" | "digits" | "right" | "region";
export type PlatePosition = { section: Exclude<Section, "region">; index: number };
export type PlateVehicle = "car" | "motorcycle" | "truck";
export function platePositions(vehicle: PlateVehicle): PlatePosition[] {
  const groups: Array<[PlatePosition["section"], number]> = vehicle === "motorcycle"
    ? [["digits", 4], ["right", 2]]
    : vehicle === "truck" ? [["left", 2], ["digits", 4]] : [["left", 1], ["digits", 3], ["right", 2]];
  return groups.flatMap(([section, count]) => Array.from({ length: count }, (_, index) => ({ section, index })));
}
export function movePlatePosition(vehicle: PlateVehicle, position: PlatePosition, direction: -1 | 1): PlatePosition {
  const positions = platePositions(vehicle);
  const index = positions.findIndex(item => item.section === position.section && item.index === position.index);
  return positions[Math.max(0, Math.min(positions.length - 1, index + direction))];
}
// Typing the final character finishes plate entry; arrow navigation still clamps.
export function nextPlateInputPosition(vehicle: PlateVehicle, position: PlatePosition): PlatePosition | 'region' {
  const positions = platePositions(vehicle);
  const index = positions.findIndex(item => item.section === position.section && item.index === position.index);
  return index === positions.length - 1 ? 'region' : movePlatePosition(vehicle, position, 1);
}
export function plateDeletionPosition(vehicle: PlateVehicle, values: Record<PlatePosition['section'], string>, position: PlatePosition): PlatePosition {
  const character = values[position.section][position.index];
  return character && character !== '*' ? position : movePlatePosition(vehicle, position, -1);
}
// Replacing or deleting one character must preserve every other position.
export function replacePlateCharacter(current: string, value: string, index: number, limit: number) {
  if (index < 0 || index >= limit || value.length !== 1) return current;
  const characters = current.padEnd(limit, "*").slice(0, limit).split("");
  characters[index] = value;
  return characters.every(character => character === "*") ? "" : characters.join("");
}
export function appendPlateCharacter(current: string, value: string, limit: number) {
  return limit <= 1 || current.length >= limit ? value : `${current}${value}`;
}
export function nextPlateSection(section: Section, value: string, format: { left: number; digits: number; right: number }): Section {
  if (section === "region" || value.length < format[section]) return section;
  if (section === "left") return "digits";
  if (section === "digits") return format.right > 0 ? "right" : "region";
  return "region";
}
