export const linkedRegions = [
  { key: 'moskva', title: 'Москва' },
  { key: 'moskovskaya-oblast', title: 'Московская область' },
  { key: 'sankt-peterburg', title: 'Санкт-Петербург' },
  { key: 'krasnodarskiy-kray', title: 'Краснодарский край' },
  { key: 'stavropolskiy-kray', title: 'Ставропольский край' },
  { key: 'rostovskaya-oblast', title: 'Ростовская область' },
  { key: 'sverdlovskaya-oblast', title: 'Свердловская область' },
  { key: 'novosibirskaya-oblast', title: 'Новосибирская область' },
  { key: 'dagestan', title: 'Республика Дагестан' },
] as const;
const normalize = (value: string) => value.trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');

// A region in the URL selects the existing search filter, not another screen.
// Exact titles keep Moscow distinct from Moscow Oblast; a numeric value is
// a single registration code, whereas a region name includes all its codes.
export function regionFromLink(value: string | string[] | undefined, rows: readonly { region: string }[]) {
  if (typeof value !== 'string' || value.length > 100 || !value.trim()) return null;
  const input = normalize(value);
  const alias = input === 'moscow' ? 'moskva' : input;
  const known = linkedRegions.find(item => item.key === alias);
  const title = known?.title ?? value.trim();
  const numeric = /^\d{2,3}$/.test(input);
  const match = rows.find(row => numeric
    ? row.region.split(' · ')[1]?.trim() === input
    : normalize(row.region.split(' · ')[0]) === normalize(title));
  if (!match) return null;
  return { region: match.region.split(' · ')[0].trim(), regionCode: numeric ? input : '' };
}

export function regionLink(title: string) {
  const value = linkedRegions.find(item => item.title === title)?.key ?? title;
  return `/?region=${encodeURIComponent(value)}`;
}
