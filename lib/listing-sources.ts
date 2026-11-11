type SourcedListing = { sourceUrl?: string; isSiteListing?: boolean; ownerId?: string; vehicle: string };
export type ListingSourceOption = { id: string; label: string; count: number };
export type ListingSourceGroup = { id: string; label: string; channels: ListingSourceOption[]; count: number };
// Official handles match the import registry in scripts/snomerami.mjs.
const snomeramiRegions: Record<string, string> = {
  snomerami01: "Республика Адыгея", snomerami02: "Республика Башкортостан",
  snomerami05: "Республика Дагестан", snomerami07: "Кабардино-Балкарская Республика",
  snomerami13: "Республика Мордовия", snomerami16: "Республика Татарстан",
  snomerami17_19: "Тыва и Хакасия", snomerami18: "Удмуртская Республика",
  snomerami21: "Чувашская республика", snomerami23: "Краснодарский край",
  snomerami124: "Красноярский край", snomerami26: "Ставропольский край",
  snomerami30: "Астраханская область", snomerami31: "Белгородская область",
  snomerami32: "Брянская область", snomerami33: "Владимирская область",
  snomerami34: "Волгоградская область", snomerami36: "Воронежская область",
  snomerami38: "Иркутская область", snomerami39: "Калининградская область",
  snomerami42: "Кемеровская область", snomerami45: "Курганская область",
  snomerami48: "Липецкая область", snomerami52: "Нижегородская область",
  snomerami54: "Новосибирская область", snomerami55: "Омская область",
  snomerami58: "Пензенская область", snomerami59: "Пермский край",
  snomerami61: "Ростовская область", snomerami62: "Рязанская область",
  snomerami163: "Самарская область", snomerami64: "Саратовская область",
  snomerami96: "Свердловская область", snomerami67: "Смоленская область",
  snomerami68: "Тамбовская область", snomerami70: "Томская область",
  snomerami71: "Тульская область", snomerami72: "Тюменская область",
  snomerami74: "Челябинская область", snomerami: "Москва и МО",
  snomerami78: "Санкт-Петербург и ЛО", snomerami180: "Донецк и ДНР",
  snomerami181: "Луганск и ЛНР", snomerami82: "Республика Крым",
  snomerami86: "Ханты-Мансийский АО",
};
const names: Record<string, string> = {
  runomer: "Красивые номера на авто",
  runomer23: "Runomer · Краснодарский край",
  runomer26: "Runomer · Ставропольский край",
  runomer61: "Runomer · Ростовская область",
  runomer66: "Runomer · Свердловская область",
  runomer54: "Runomer · Новосибирская область",
  runomer05: "Runomer · Дагестан",
  specznak: "SpecZnak",
  jelezki77: "Железки77",
};

export function listingSourceLabel(id: string): string {
  if (id === "mine") return "Свои объявления";
  if (id === "site") return "Объявления пользователей";
  if (!id.startsWith("telegram:")) return id === "external:unknown" ? "Другой источник" : id.replace(/^external:/, "");
  const handle = id.slice("telegram:".length);
  return snomeramiRegions[handle] ? `Snomerami · ${snomeramiRegions[handle]}` : names[handle] ?? `@${handle}`;
}

export function groupListingSources(options: readonly ListingSourceOption[]) {
  const direct: ListingSourceOption[] = [];
  const groups = new Map<string, ListingSourceGroup>();
  for (const source of options) {
    if (!source.id.startsWith("telegram:")) { direct.push(source); continue; }
    const handle = source.id.slice("telegram:".length);
    const network = snomeramiRegions[handle] ? { id: "snomerami", label: "Snomerami" }
      : names[handle] && /^runomer\d*$/.test(handle) ? { id: "runomer", label: "Runomer" }
      : { id: handle, label: names[handle] ?? `@${handle}` };
    const group = groups.get(network.id) ?? { ...network, channels: [], count: 0 };
    const label = snomeramiRegions[handle] ?? (handle === "runomer" ? "Общий канал" : names[handle]?.replace(/^Runomer · /, "") ?? `@${handle}`);
    group.channels.push({ ...source, label });
    group.count += source.count;
    groups.set(network.id, group);
  }
  return { direct, groups: [...groups.values()].map(group => ({ ...group, channels: group.channels.sort((a,b) => a.label.localeCompare(b.label, "ru")) })).sort((a,b) => a.label.localeCompare(b.label, "ru")) };
}

export function listingSource(listing: Pick<SourcedListing, "sourceUrl" | "isSiteListing">) {
  if (listing.isSiteListing || !listing.sourceUrl) return { id: "site", label: "Объявления пользователей" };
  try {
    const url = new URL(listing.sourceUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "t.me" || host === "telegram.me") {
      const parts = url.pathname.split("/").filter(Boolean);
      const handle = (parts[0] === "s" ? parts[1] : parts[0])?.toLowerCase();
      if (handle && /^[a-z0-9_]+$/.test(handle)) return { id: `telegram:${handle}`, label: listingSourceLabel(`telegram:${handle}`) };
    }
    return { id: `external:${host}`, label: host };
  } catch {
    return { id: "external:unknown", label: "Другой источник" };
  }
}

export function matchesListingSources(listing: Pick<SourcedListing, "sourceUrl" | "isSiteListing" | "ownerId">, selected: readonly string[], userId = "") {
  return selected.length === 0 || selected.includes(listingSource(listing).id)
    || (selected.includes("mine") && !!userId && listing.isSiteListing === true && listing.ownerId === userId);
}

export function availableListingSources<T extends SourcedListing>(listings: readonly T[], vehicle: string, archivedSources: ReadonlySet<string>, userId = "") {
  const options = new Map<string, ListingSourceOption>();
  if (userId) options.set("mine", {id:"mine",label:"Свои объявления",count:0});
  for (const listing of listings) {
    if (listing.vehicle !== vehicle || (listing.sourceUrl && archivedSources.has(listing.sourceUrl))) continue;
    const source = listingSource(listing);
    const current = options.get(source.id);
    options.set(source.id, { ...source, count: (current?.count ?? 0) + 1 });
    if(userId && listing.isSiteListing && listing.ownerId===userId) options.get("mine")!.count++;
  }
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, "ru"));
}
