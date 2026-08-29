/**
 * Safe import for the two channel owners that permitted reposting:
 * @runomer and @specznak. It stores only plate, price, region, post date
 * and a direct Telegram post URL. Contacts and the original post text are
 * deliberately never written to Supabase.
 *
 * Required environment variables:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (server/CI only, never in the mobile app)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the importer.");
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SOURCES = [
  { handle: "runomer", name: "Красивые номера на авто" },
  { handle: "specznak", name: "Красивые госномера Specznak" },
];

// Only codes whose Russian region name is known to the importer are accepted.
// An unknown code is skipped instead of publishing a misleading region.
const REGION_NAMES = new Map([
  ["50", "Московская область"], ["90", "Московская область"], ["150", "Московская область"], ["190", "Московская область"], ["250", "Московская область"], ["550", "Московская область"], ["750", "Москва"],
  ["77", "Москва"], ["97", "Москва"], ["99", "Москва"], ["177", "Москва"], ["197", "Москва"], ["199", "Москва"], ["777", "Москва"], ["797", "Москва"], ["799", "Москва"], ["977", "Москва"], ["997", "Москва"],
  ["23", "Краснодарский край"], ["93", "Краснодарский край"], ["123", "Краснодарский край"], ["26", "Ставропольский край"], ["126", "Ставропольский край"], ["54", "Новосибирская область"], ["154", "Новосибирская область"], ["61", "Ростовская область"], ["161", "Ростовская область"], ["66", "Свердловская область"], ["96", "Свердловская область"], ["196", "Свердловская область"],
]);

const latinToCyrillic = { A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х", Y: "У", V: "В" };
const normalizeLetter = (letter) => latinToCyrillic[letter.toUpperCase()] ?? letter.toUpperCase();
const decodeHtml = (value) => value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, " ").trim();

function classifyTag(left, digits, right) {
  if (/^(\d)\1\1$/.test(digits)) return "Одинаковые цифры";
  if (digits[0] === digits[2]) return "Зеркальный";
  if (right[0] === right[1] || left === right[0]) return "Одинаковые буквы";
  if (digits === "001" || digits === "007") return "Нули";
  return "Красивый номер";
}

function parsePost(text, source, postId, postedAt) {
  // Each accepted row must have a plate, a price immediately after it, and a known region code.
  // Contacts are irrelevant and purposely ignored.
  const row = /([АВЕКМНОРСТУХA-Z])\s?(\d{3})\s?([АВЕКМНОРСТУХA-Z]{2})\s?(\d{2,3})(?=[^\n]{0,120}(?:💰|цена\s*[:—-]?))[^\n]{0,120}?(?:💰|цена\s*[:—-]?)\s*(\d[\d\s,]*)/gim;
  const entries = [];
  for (const match of text.matchAll(row)) {
    const [, rawLeft, digits, rawRight, regionCode, rawPrice] = match;
    const name = REGION_NAMES.get(regionCode);
    const price = Number(rawPrice.replace(/[^\d]/g, ""));
    if (!name || !Number.isSafeInteger(price) || price < 5_000 || price > 50_000_000) continue;
    const left = normalizeLetter(rawLeft);
    const right = [...rawRight].map(normalizeLetter).join("");
    entries.push({
      id: `${source.handle}-${postId}-${left}${digits}${right}${regionCode}`.toLowerCase(),
      plate_left: left,
      plate_digits: digits,
      plate_right: right,
      region: `${name} · ${regionCode}`,
      vehicle_type: "car",
      price_rub: price,
      tag: classifyTag(left, digits, right),
      source_name: source.name,
      source_url: `https://t.me/${source.handle}/${postId}`,
      status: "active",
      archive_reason: null,
      checked_at: new Date().toISOString(),
      created_at: postedAt ?? new Date().toISOString(),
    });
  }
  return entries;
}

function extractPosts(html, source) {
  const message = /<div class="tgme_widget_message[^>]*data-post="([^"]+)"[\s\S]*?(?=<div class="tgme_widget_message|<div class="tgme_widget_message_wrap|$)/g;
  const posts = [];
  for (const found of html.matchAll(message)) {
    const [, identifier] = found;
    const block = found[0];
    const postId = identifier.split("/").at(-1);
    const content = block.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i)?.[1];
    if (!postId || !content) continue;
    const datetime = block.match(/<time[^>]+datetime="([^"]+)"/i)?.[1];
    const text = decodeHtml(content);
    const sold = /\b(продан[аоы]?|забронирован[аоы]?|снят[аоы]? с продажи)\b/i.test(text);
    posts.push({ postId, text, postedAt: datetime, sold });
  }
  return posts;
}

function wasPublishedWithinLastDay(postedAt) {
  if (!postedAt) return false;
  const timestamp = Date.parse(postedAt);
  return Number.isFinite(timestamp) && timestamp <= Date.now() && Date.now() - timestamp <= ONE_DAY_MS;
}

async function syncSource(source) {
  const response = await fetch(`https://t.me/s/${source.handle}`, { headers: { "user-agent": "ZaNomer catalog checker/1.0" } });
  if (!response.ok) throw new Error(`${source.handle}: HTTP ${response.status}`);
  const posts = extractPosts(await response.text(), source);
  let added = 0;
  let archived = 0;
  for (const post of posts) {
    const sourceUrl = `https://t.me/${source.handle}/${post.postId}`;
    if (post.sold) {
      const { error } = await db.from("partner_listings").update({ status: "archived", archive_reason: "В исходном посте указано, что номер продан или забронирован", checked_at: new Date().toISOString() }).eq("source_url", sourceUrl);
      if (error) throw error;
      await db.from("partner_listing_statuses").upsert({ source_url: sourceUrl, status: "archived", archive_reason: "В исходном посте указано, что номер продан или забронирован", checked_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      archived += 1;
      continue;
    }
    // Telegram may show older posts on the public channel page. Do not import
    // them retroactively: only genuinely recent publications enter the catalog.
    if (!wasPublishedWithinLastDay(post.postedAt)) continue;
    const rows = parsePost(post.text, source, post.postId, post.postedAt);
    if (!rows.length) continue;
    const { error } = await db.from("partner_listings").upsert(rows, { onConflict: "id" });
    if (error) throw error;
    await db.from("partner_listing_statuses").upsert({ source_url: sourceUrl, status: "active", archive_reason: null, checked_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    added += rows.length;
  }
  return { source: source.name, posts: posts.length, added, archived };
}

const result = [];
for (const source of SOURCES) result.push(await syncSource(source));
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), result }, null, 2));
