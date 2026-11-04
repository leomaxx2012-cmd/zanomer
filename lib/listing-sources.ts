type SourcedListing = { sourceUrl?: string; isSiteListing?: boolean; ownerId?: string; vehicle: string };
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

export function listingSource(listing: Pick<SourcedListing, "sourceUrl" | "isSiteListing">) {
  if (listing.isSiteListing || !listing.sourceUrl) return { id: "site", label: "Объявления пользователей" };
  try {
    const url = new URL(listing.sourceUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "t.me" || host === "telegram.me") {
      const parts = url.pathname.split("/").filter(Boolean);
      const handle = (parts[0] === "s" ? parts[1] : parts[0])?.toLowerCase();
      if (handle && /^[a-z0-9_]+$/.test(handle)) return { id: `telegram:${handle}`, label: names[handle] ?? `@${handle}` };
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
  const options = new Map<string, { id: string; label: string; count: number }>();
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
