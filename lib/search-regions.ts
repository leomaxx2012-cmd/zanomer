type RegionGroup = { title: string; codes: { value: string }[] };

export function selectedSearchRegionCodes(groups: RegionGroup[], region: string, regionCode: string): string[] {
  const codes = regionCode.split(",").map(code => code.trim()).filter(Boolean);
  return codes.length ? codes : groups.find(group => group.title === region)?.codes.map(code => code.value) ?? [];
}

export function searchRegionNames(groups: RegionGroup[], codes: string[]): string[] {
  return groups.filter(group => group.codes.some(code => codes.includes(code.value))).map(group => group.title);
}

export function toggleSearchRegion(groups: RegionGroup[], region: string, regionCode: string, values: string[]) {
  const current = selectedSearchRegionCodes(groups, region, regionCode);
  const remove = values.every(value => current.includes(value));
  const codes = remove ? current.filter(value => !values.includes(value)) : [...new Set([...current, ...values])];
  codes.sort((a, b) => Number(a) - Number(b));
  return { region: codes.length ? searchRegionNames(groups, codes).join(", ") || region : "Все", regionCode: codes.join(",") };
}
