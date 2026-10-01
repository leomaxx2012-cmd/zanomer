/**
 * Nightly import from the only permitted VK source supplied by the owner.
 *
 * The job performs exactly one unauthenticated request to the public
 * community page. It does not follow private links, collect contacts or
 * inspect any other VK community. Only a complete plate + price + region is
 * retained; post text is used in memory and never stored.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the VK importer.");
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const SOURCE = {
  id: "vk-aautonomera777",
  name: "АВТОНОМЕРА777",
  url: "https://vk.ru/aautonomera777",
};
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const REGION_NAMES = new Map([
  ["50", "Московская область"], ["90", "Московская область"], ["150", "Московская область"], ["190", "Московская область"], ["250", "Московская область"], ["550", "Московская область"], ["750", "Москва"],
  ["77", "Москва"], ["97", "Москва"], ["99", "Москва"], ["177", "Москва"], ["197", "Москва"], ["199", "Москва"], ["777", "Москва"], ["797", "Москва"], ["799", "Москва"], ["977", "Москва"], ["997", "Москва"],
  ["23", "Краснодарский край"], ["93", "Краснодарский край"], ["123", "Краснодарский край"], ["193", "Краснодарский край"], ["323", "Краснодарский край"],
  ["26", "Ставропольский край"], ["126", "Ставропольский край"], ["61", "Ростовская область"], ["161", "Ростовская область"],
  ["66", "Свердловская область"], ["96", "Свердловская область"], ["196", "Свердловская область"], ["54", "Новосибирская область"], ["154", "Новосибирская область"],
  ["05", "Республика Дагестан"], ["95", "Чеченская Республика"],
]);
const latinToCyrillic = { A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х", Y: "У", V: "В" };
const normalizeLetter = (letter) => latinToCyrillic[letter.toUpperCase()] ?? letter.toUpperCase();
const normaliseRegionCode = (value) => {
  const digits = String(value).replace(/\D/g, "");
  return digits.length === 1 ? `0${digits}` : digits;
};
const decodeHtml = (value) => value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
  .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
  .replace(/\s+/g, " ").trim();

function classifyTag(left, digits, right) {
  if (/^(\d)\1\1$/.test(digits)) return "Одинаковые цифры";
  if (digits[0] === digits[2]) return "Зеркальный";
  if (right[0] === right[1] || left === right[0]) return "Одинаковые буквы";
  if (digits === "001" || digits === "007") return "Нули";
  return "Красивый номер";
}

function isRecent(timestamp) {
  const value = Date.parse(timestamp ?? "");
  return Number.isFinite(value) && value <= Date.now() + 6 * 60 * 60 * 1000 && Date.now() - value <= ONE_DAY_MS;
}

function matchesSearchAlert(row, alert) {
  const regionCode = row.region.split(" · ").at(-1)?.trim() ?? "";
  const matchesPattern = (value, pattern) => {
    const clean = (pattern ?? "").trim().toUpperCase();
    if (!clean) return true;
    if (!clean.includes("*")) return value.includes(clean);
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".");
    return new RegExp(escaped).test(value);
  };
  const selectedCodes = String(alert.region_code ?? "").split(",").map((code) => code.trim()).filter(Boolean);
  const matchesRegion = selectedCodes.length > 0
    ? selectedCodes.includes(regionCode)
    : alert.region === "Все" || row.region.startsWith(alert.region ?? "");
  return matchesPattern(row.plate_left, alert.left_letter)
    && matchesPattern(row.plate_right, alert.right_letters)
    && matchesPattern(row.plate_digits, alert.digits)
    && matchesRegion
    && (!alert.vehicle_type || alert.vehicle_type === row.vehicle_type)
    && (!alert.price_limit || row.price_rub <= alert.price_limit);
}

async function notifySearchAlerts(rows) {
  if (!rows.length) return 0;
  const { data: alerts, error: alertError } = await db.from("auto_search_alerts")
    .select("id,owner_id,left_letter,right_letters,digits,region,region_code,vehicle_type,price_limit").eq("enabled", true);
  if (alertError) throw alertError;
  const matches = (alerts ?? []).flatMap((alert) => rows.filter((row) => matchesSearchAlert(row, alert)).map((row) => ({ alert, row })));
  if (!matches.length) return 0;
  const ownerIds = [...new Set(matches.map(({ alert }) => alert.owner_id))];
  const { data: tokens, error: tokenError } = await db.from("auto_push_tokens").select("owner_id,token").in("owner_id", ownerIds);
  if (tokenError) throw tokenError;
  const tokensByOwner = new Map();
  for (const token of tokens ?? []) tokensByOwner.set(token.owner_id, [...(tokensByOwner.get(token.owner_id) ?? []), token.token]);
  const messages = matches.flatMap(({ alert, row }) => (tokensByOwner.get(alert.owner_id) ?? []).map((token) => ({
    to: token,
    sound: "default",
    title: "Подходящий номер появился",
    body: `${row.plate_left} ${row.plate_digits} ${row.plate_right} · ${row.region}`,
    data: { kind: "search-alert", listingId: row.id, alertId: alert.id },
  })));
  if (messages.length) await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(messages),
  });
  return messages.length;
}

function createRow({ postId, postedAt, rawLeft, digits, rawRight, regionCode, rawPrice }) {
  const region = normaliseRegionCode(regionCode);
  const name = REGION_NAMES.get(region);
  const price = Number(rawPrice.replace(/[^\d]/g, ""));
  if (!name || !Number.isSafeInteger(price) || price < 5_000 || price > 50_000_000) return null;
  const left = normalizeLetter(rawLeft);
  const right = [...rawRight].map(normalizeLetter).join("");
  const compactId = String(postId).replace(/[^\d_-]/g, "");
  return {
    id: `${SOURCE.id}-${compactId}-${left}${digits}${right}${region}`.toLowerCase(),
    plate_left: left,
    plate_digits: digits,
    plate_right: right,
    region: `${name} · ${region}`,
    vehicle_type: "car",
    price_rub: price,
    tag: classifyTag(left, digits, right),
    source_name: SOURCE.name,
    source_url: `https://vk.ru/wall${postId}`,
    status: "active",
    archive_reason: null,
    checked_at: new Date().toISOString(),
    created_at: postedAt,
  };
}

function parseRows(text, postId, postedAt) {
  const rows = [];
  const pattern = /([АВЕКМНОРСТУХA-Z])\s?(\d{3})\s?([АВЕКМНОРСТУХA-Z]{2})\s?(\d{2,3})[\s\S]{0,120}?(?:💰|цена\s*[:—-]?)\s*(\d[\d\s,]*)/gim;
  for (const match of text.matchAll(pattern)) {
    const [, rawLeft, digits, rawRight, regionCode, rawPrice] = match;
    const row = createRow({ postId, postedAt, rawLeft, digits, rawRight, regionCode, rawPrice });
    if (row) rows.push(row);
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function extractTimestamp(block) {
  const iso = block.match(/(?:datetime|data-date|data-post-date)=["']([^"']+)["']/i)?.[1];
  if (iso && Number.isFinite(Date.parse(iso))) return new Date(iso).toISOString();
  const unix = block.match(/(?:date|publish_date|post_date)["']?\s*[:=]\s*["']?(\d{10})(?:\d{3})?["']?/i)?.[1];
  return unix ? new Date(Number(unix) * 1_000).toISOString() : null;
}

function extractPosts(html) {
  // VK exposes public post IDs in server-rendered markup. Split only at a
  // following post marker, so text from neighbouring posts is never mixed.
  const marker = /(?:id|data-post-id)=["'](?:post)?(-?\d+_\d+)["']/gi;
  const matches = [...html.matchAll(marker)];
  const posts = [];
  for (const [index, match] of matches.entries()) {
    const block = html.slice(match.index, matches[index + 1]?.index ?? html.length);
    const postId = match[1];
    const textMatch = block.match(/(?:wall_post_text|PostText|post_text)[^>]*>([\s\S]*?)<\/div>/i);
    const text = decodeHtml(textMatch?.[1] ?? block);
    posts.push({ postId, text, postedAt: extractTimestamp(block), sold: /\b(продан[аоы]?|продали|забронирован[аоы]?|зарезервирован[аоы]?|в резерве|снят[аоы]? с продажи|нет в наличии)\b/i.test(text) });
  }
  return [...new Map(posts.map((post) => [post.postId, post])).values()];
}

async function hasCatalogDuplicate(row) {
  const match = (query) => query.eq("plate_left", row.plate_left).eq("plate_digits", row.plate_digits)
    .eq("plate_right", row.plate_right).eq("region", row.region).eq("vehicle_type", row.vehicle_type).limit(1);
  const [{ data: partner, error: partnerError }, { data: own, error: ownError }] = await Promise.all([
    match(db.from("partner_listings").select("id").neq("id", row.id)),
    match(db.from("auto_listings").select("id").eq("status", "active")),
  ]);
  if (partnerError) throw partnerError;
  if (ownError) throw ownError;
  return Boolean(partner?.length || own?.length);
}

async function syncPost(post) {
  const sourceUrl = `https://vk.ru/wall${post.postId}`;
  if (post.sold) {
    const now = new Date().toISOString();
    const { error } = await db.from("partner_listings").update({ status: "archived", archive_reason: "В исходном посте указано, что номер продан или забронирован", checked_at: now }).eq("source_url", sourceUrl);
    if (error) throw error;
    await db.from("partner_listing_statuses").upsert({ source_url: sourceUrl, status: "archived", archive_reason: "В исходном посте указано, что номер продан или забронирован", checked_at: now, updated_at: now });
    return { added: 0, archived: 1, skippedDuplicates: 0 };
  }
  if (!isRecent(post.postedAt)) return { added: 0, archived: 0, skippedDuplicates: 0 };
  const rows = parseRows(post.text, post.postId, post.postedAt);
  let added = 0;
  let skippedDuplicates = 0;
  const newlyAddedRows = [];
  for (const row of rows) {
    const { data: known, error: knownError } = await db.from("partner_listings").select("id").eq("id", row.id).maybeSingle();
    if (knownError) throw knownError;
    if (!known && await hasCatalogDuplicate(row)) {
      skippedDuplicates += 1;
      continue;
    }
    const { error } = await db.from("partner_listings").upsert(row, { onConflict: "id" });
    if (error) throw error;
    if (!known) {
      added += 1;
      newlyAddedRows.push(row);
    }
  }
  await notifySearchAlerts(newlyAddedRows);
  if (rows.length) {
    const now = new Date().toISOString();
    await db.from("partner_listing_statuses").upsert({ source_url: sourceUrl, status: "active", archive_reason: null, checked_at: now, updated_at: now });
  }
  return { added, archived: 0, skippedDuplicates };
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 20_000);
try {
  const response = await fetch(SOURCE.url, {
    signal: controller.signal,
    headers: { "user-agent": "ZaNomer catalog checker/1.1", accept: "text/html,application/xhtml+xml" },
  });
  if (!response.ok) throw new Error(`VK returned HTTP ${response.status}`);
  const html = await response.text();
  if (!html.includes("aautonomera777")) throw new Error("Public community identifier was not found in the response");
  const posts = extractPosts(html);
  const totals = { added: 0, archived: 0, skippedDuplicates: 0 };
  for (const post of posts) {
    const result = await syncPost(post);
    totals.added += result.added;
    totals.archived += result.archived;
    totals.skippedDuplicates += result.skippedDuplicates;
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), source: SOURCE.name, posts: posts.length, ...totals }, null, 2));
} finally {
  clearTimeout(timeout);
}
