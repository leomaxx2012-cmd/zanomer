type Section = "left" | "digits" | "right" | "region";
export function nextPlateSection(section: Section, value: string, format: { left: number; digits: number; right: number }): Section {
  if (section === "region" || value.length < format[section]) return section;
  if (section === "left") return "digits";
  if (section === "digits") return format.right > 0 ? "right" : "region";
  return "region";
}
