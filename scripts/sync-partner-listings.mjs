/**
 * Safe import for the two channel owners that permitted reposting:
 * @runomer, its regional Runomer channels, @specznak, and @jelezki77. It stores only plate, price, region, post date
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
