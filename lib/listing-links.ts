export function sharedListingId(value: unknown): string | null {
  const id = Array.isArray(value) ? value[0] : value;
  return typeof id === 'string' && /^[A-Za-zА-Яа-яЁё0-9_-]{1,240}$/.test(id) ? id : null;
}

export function listingLink(id: string, isSiteListing = false, native = false): string {
  const url = new URL(native ? 'avtonomer:///' : 'https://zanomerom.ru/');
  url.searchParams.set('listing', id);
  url.searchParams.set('kind', isSiteListing ? 'site' : 'partner');
  return url.toString();
}

export function sharedListingTable(id: string, kind: unknown): 'auto_listings' | 'partner_listings' {
  if (kind === 'site') return 'auto_listings';
  if (kind === 'partner') return 'partner_listings';
  // Keep previously shared site links without a kind parameter working.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? 'auto_listings' : 'partner_listings';
}
