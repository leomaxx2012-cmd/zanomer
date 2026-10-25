type RegionGroup = { title: string; codes: { value: string }[] };

export function compactSearchRegions(groups: RegionGroup[], codes: string[]) {
  const selected = [...new Set(codes)];
  const whole = groups.filter(group => group.codes.length > 0 && group.codes.every(code => selected.includes(code.value)));
  const abbreviate = (title: string) => ({
    "Москва": "Мск", "Московская область": "МО", "Санкт-Петербург": "СПб", "Ленинградская область": "ЛО",
    "Краснодарский край": "Краснодар. кр.", "Свердловская область": "Свердл. обл.", "Новосибирская область": "Новосиб. обл.",
    "Ростовская область": "Ростов. обл.", "Республика Татарстан": "Татарстан",
    "Ханты-Мансийский автономный округ": "ХМАО", "Ямало-Ненецкий автономный округ": "ЯНАО",
    "Ненецкий автономный округ": "НАО", "Еврейская автономная область": "ЕАО",
  }[title] ?? title.replace(/^Республика\s+/, "Респ. ").replace(/\s+Республика$/, " Респ.").replace(/\s+область$/, " обл.").replace(/\s+край$/, " кр.").replace(/\s+автономный округ$/, " АО"));
  return {
    codes: selected.length > 2 ? `${selected[0]} +${selected.length - 1}` : selected.join(", ") || "—",
    names: whole.map(group => abbreviate(group.title)).join(", "),
  };
}

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
