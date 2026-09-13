/**
 * Creates an offline catalogue packed into the Android release APK.
 *
 * The Android client still refreshes from Supabase when possible. This file is
 * the reliable first screen and fallback for mobile networks where a live
 * Supabase request is blocked or slow. The key is the public client key, never
 * a service-role key.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://qiqnbjdgkhbtfpxqtpio.supabase.co";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_F-nhmdzQnvxe3stusjD-NA_i1-AOXOB";
const db = createClient(url, anonKey, { auth: { persistSession: false } });
const pageSize = 1000;
const fields = "id, plate_left, plate_digits, plate_right, region, vehicle_type, price_rub, created_at, tag, source_name, source_url, featured_until";

const rows = [];
for (let start = 0; ; start += pageSize) {
  const { data, error } = await db
    .from("partner_listings")
    .select(fields)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(start, start + pageSize - 1);
  if (error) throw new Error(`Cannot create offline catalogue: ${error.message}`);
  rows.push(...(data ?? []));
  if ((data ?? []).length < pageSize) break;
}

const unique = new Map();
for (const item of rows) {
  const key = `${item.vehicle_type}|${item.plate_left}${item.plate_digits}${item.plate_right}|${item.region.trim().toLocaleUpperCase("ru-RU")}`;
  if (!unique.has(key)) unique.set(key, item);
}

const catalogue = [...unique.values()]
  .map((item) => ({
    id: item.id,
    value: `${item.plate_left} ${item.plate_digits} ${item.plate_right}`,
    leftLetter: item.plate_left,
    rightLetters: item.plate_right,
    digits: item.plate_digits,
    region: item.region,
    price: `${Number(item.price_rub).toLocaleString("ru-RU")} ₽`,
    priceValue: Number(item.price_rub),
    vehicle: item.vehicle_type,
    seller: item.source_name,
    createdAt: item.created_at.slice(0, 10),
    publishedAt: item.created_at,
    tag: item.tag ?? "Партнёрское объявление",
    sourceName: "Открыть исходное объявление",
    sourceUrl: item.source_url,
    featuredUntil: item.featured_until,
  }))
  .sort((first, second) => second.publishedAt.localeCompare(first.publishedAt));

if (!catalogue.length) throw new Error("Offline catalogue is empty; refusing to build a demo-only APK.");
await writeFile("assets/catalog-snapshot.json", `${JSON.stringify(catalogue)}\n`, "utf8");
console.log(`Packed ${catalogue.length} unique listings into the Android offline catalogue.`);
// supabase-js may retain internal timers in a Node process. End explicitly so
// the GitHub Actions build continues immediately after the snapshot is saved.
process.exit(0);
