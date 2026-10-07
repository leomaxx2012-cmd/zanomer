export const COMPARISON_LIMIT = 4;
type Comparable = { id: string; priceValue: number };
export function toggleCompared<T extends Comparable>(items: T[], item: T): T[] {
  if (items.some(current => current.id === item.id)) return items.filter(current => current.id !== item.id);
  return items.length < COMPARISON_LIMIT ? [...items, item] : items;
}
export function comparisonPrices<T extends Comparable>(selected: T[], catalog: T[]) {
  const live = selected.map(item => catalog.find(current => current.id === item.id) ?? item);
  const minimum = live.length ? Math.min(...live.map(item => item.priceValue)) : 0;
  return live.map(item => ({ item, difference: item.priceValue - minimum }));
}
