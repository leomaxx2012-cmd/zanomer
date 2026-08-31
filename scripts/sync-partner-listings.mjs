/**
 * Safe import for the channel owners that permitted reposting:
 * @runomer, its regional Runomer channels, @specznak, and @jelezki77. It stores only plate, price, region, post date
 * and a direct Telegram post URL. Contacts and the original post text are
 * deliberately never written to Supabase.
 *
 * Required environment variables:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (server/CI only, never in the mobile app)
 */
import { createClient } from "@supabase/supabase-js";
import { createWorker } from "tesseract.js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the importer.");
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SOURCES = [
  { handle: "runomer", name: "Красивые номера на авто" },
  { handle: "runomer23", name: "Красивые номера Краснодар" },
  { handle: "runomer26", name: "Красивые номера Ставрополь" },
  { handle: "runomer61", name: "Красивые номера Ростов" },
  { handle: "runomer66", name: "Красивые номера Екатеринбург" },
  { handle: "runomer54", name: "Красивые номера Новосибирск" },
  { handle: "runomer05", name: "Красивые номера Дагестан" },
  { handle: "specznak", name: "Красивые госномера Specznak" },
  { handle: "jelezki77", name: "Железки77" },
];

// Only codes whose Russian region name is known to the importer are accepted.
// An unknown code is skipped instead of publishing a misleading region.
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
const decodeHtml = (value) => value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, " ").trim();
const decodeUrl = (value) => value.replace(/&amp;/gi, "&").replace(/&#39;/g, "'");

// OCR is used only as a fallback when the post text itself does not contain a
// complete listing. Recognised text is parsed in memory and is never saved.
// In particular, this lets the importer read a region code printed on a plate
// photo when the post caption contains only the price.
let ocrWorkerPromise;
async function recognisePhotos(photoUrls) {
  if (!photoUrls.length) return "";
  ocrWorkerPromise ??= createWorker("eng");
  const worker = await ocrWorkerPromise;
  const parts = [];
  for (const photoUrl of photoUrls.slice(0, 2)) {
    try {
      const { data } = await worker.recognize(photoUrl);
      if (data.text) parts.push(data.text);
    } catch (error) {
      // A deleted, private, or unreadable image must not stop the channel check.
      console.warn(`Photo OCR skipped: ${error.message}`);
    }
  }
  return parts.join("\n");
}

function classifyTag(left, digits, right) {
  if (/^(\d)\1\1$/.test(digits)) return "Одинаковые цифры";
  if (digits[0] === digits[2]) return "Зеркальный";
  if (right[0] === right[1] || left === right[0]) return "Одинаковые буквы";
  if (digits === "001" || digits === "007") return "Нули";
  return "Красивый номер";
}

function normaliseRegionCode(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 1) return `0${digits}`;
  return digits;
}

function findSingleExplicitPrice(text) {
  const labelled = [...text.matchAll(/(?:💰|цена\s*[:—-]?)\s*(\d[\d\s,]*)/gi)]
    .map((match) => Number(match[1].replace(/[^\d]/g, "")))
    .filter((price) => Number.isSafeInteger(price) && price >= 5_000 && price <= 50_000_000);
  const unique = [...new Set(labelled)];
  return unique.length === 1 ? unique[0] : null;
}

function createRow({ source, postId, postedAt, rawLeft, digits, rawRight, regionCode, price }) {
  const normalizedRegionCode = normaliseRegionCode(regionCode);
  const name = REGION_NAMES.get(normalizedRegionCode);
  if (!name || !Number.isSafeInteger(price) || price < 5_000 || price > 50_000_000) return null;
  const left = normalizeLetter(rawLeft);
  const right = [...rawRight].map(normalizeLetter).join("");
  return {
    id: `${source.handle}-${postId}-${left}${digits}${right}${normalizedRegionCode}`.toLowerCase(),
    plate_left: left,
    plate_digits: digits,
    plate_right: right,
    region: `${name} · ${normalizedRegionCode}`,
    vehicle_type: "car",
    price_rub: price,
    tag: classifyTag(left, digits, right),
    source_name: source.name,
    source_url: `https://t.me/${source.handle}/${postId}`,
    status: "active",
    archive_reason: null,
    checked_at: new Date().toISOString(),
    created_at: postedAt ?? new Date().toISOString(),
  };
}

function parsePost(text, source, postId, postedAt) {
  // Each accepted row must have a plate, a price immediately following it
  // (on the same or the next caption line), and a known region code.
  // Telegram posts commonly use “P 747 EP 323\n💰 45,000”.
  // Contacts are irrelevant and purposely ignored.
  const row = /([АВЕКМНОРСТУХA-Z])\s?(\d{3})\s?([АВЕКМНОРСТУХA-Z]{2})\s?(\d{2,3})[\s\S]{0,120}?(?:💰|цена\s*[:—-]?)\s*(\d[\d\s,]*)/gim;
  const entries = [];
  for (const match of text.matchAll(row)) {
    const [, rawLeft, digits, rawRight, regionCode, rawPrice] = match;
    const price = Number(rawPrice.replace(/[^\d]/g, ""));
    const entry = createRow({ source, postId, postedAt, rawLeft, digits, rawRight, regionCode, price });
    if (entry) entries.push(entry);
  }

  // OCR often puts the plate and its region on a separate line, while the
  // caption has the price. Accept this only when the caption has one explicit
  // price; two prices would make it impossible to link the correct one safely.
  if (!entries.length) {
    const price = findSingleExplicitPrice(text);
    const plateWithPhotoRegion = /([АВЕКМНОРСТУХABCEHKMOPTXY])\s?(\d{3})\s?([АВЕКМНОРСТУХABCEHKMOPTXY]{2})\s*(?:RUS|RU|РУС)?\s*(\d{1,3})\b/gim;
    for (const match of text.matchAll(plateWithPhotoRegion)) {
      const [, rawLeft, digits, rawRight, regionCode] = match;
      const entry = createRow({ source, postId, postedAt, rawLeft, digits, rawRight, regionCode, price });
      if (entry) entries.push(entry);
    }
  }
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()];
}

function extractPosts(html, source) {
  // Do not stop at nested elements such as `tgme_widget_message_text`.
  // `\b` after "message" matches a new message block but not an underscore.
  const message = /<div class="tgme_widget_message\b[^>]*data-post="([^"]+)"[\s\S]*?(?=<div class="tgme_widget_message\b|<div class="tgme_widget_message_wrap|$)/g;
  const posts = [];
  for (const found of html.matchAll(message)) {
    const [, identifier] = found;
    const block = found[0];
    const postId = identifier.split("/").at(-1);
    const content = block.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
    if (!postId) continue;
    const datetime = block.match(/<time[^>]+datetime="([^"]+)"/i)?.[1];
    const text = decodeHtml(content);
    const photoUrls = [...block.matchAll(/tgme_widget_message_photo_wrap[^>]+style="[^"]*url\(['"]?([^'"\)]+)['"]?\)/gi)]
      .map((match) => decodeUrl(match[1]));
    // Archive only explicit availability changes. "Продам" is deliberately
    // absent: it means the plate is offered, not sold.
    const sold = /\b(продан[аоы]?|продали|забронирован[аоы]?|зарезервирован[аоы]?|в резерве|снят[аоы]? с продажи|нет в наличии)\b/i.test(text);
    posts.push({ postId, text, photoUrls, postedAt: datetime, sold });
  }
  return posts;
}

function wasPublishedWithinLastDay(postedAt) {
  if (!postedAt) return false;
  const timestamp = Date.parse(postedAt);
  // Telegram timestamps are UTC, while a freshly published post can appear a
  // few hours ahead of a GitHub runner because of edge-cache clock skew.
  // Permit that small skew, but never import posts older than one day.
  return Number.isFinite(timestamp)
    && timestamp <= Date.now() + 6 * 60 * 60 * 1000
    && Date.now() - timestamp <= ONE_DAY_MS;
}

async function syncSource(source) {
  // A changing query parameter bypasses Telegram's CDN cache. Without it a
  // runner can receive a channel page from the previous day.
  const response = await fetch(`https://t.me/s/${source.handle}?check=${Date.now()}`, {
    headers: {
      "user-agent": "ZaNomer catalog checker/1.0",
      "cache-control": "no-cache",
    },
  });
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
    let rows = parsePost(post.text, source, post.postId, post.postedAt);
    if (!rows.length && post.photoUrls.length) {
      const photoText = await recognisePhotos(post.photoUrls);
      rows = parsePost(`${post.text}\n${photoText}`, source, post.postId, post.postedAt);
    }
    if (!rows.length) continue;
    const { error } = await db.from("partner_listings").upsert(rows, { onConflict: "id" });
    if (error) throw error;
    await db.from("partner_listing_statuses").upsert({ source_url: sourceUrl, status: "active", archive_reason: null, checked_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    added += rows.length;
  }
  return { source: source.name, posts: posts.length, added, archived };
}

const result = [];
for (const source of SOURCES) {
  try {
    result.push(await syncSource(source));
  } catch (error) {
    // A temporarily unavailable source must not prevent checking the others.
    // No listings are created or archived for this source on an error.
    console.warn(`${source.handle}: ${error.message}`);
    result.push({ source: source.name, error: error.message, added: 0, archived: 0 });
  }
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), result }, null, 2));
if (ocrWorkerPromise) (await ocrWorkerPromise).terminate();
