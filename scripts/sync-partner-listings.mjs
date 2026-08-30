/**
 * Safe import for the two channel owners that permitted reposting:
 * @runomer, its regional Runomer channels, and @specznak. It stores only plate, price, region, post date
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
];

// Only codes whose Russian region name is known to the importer are accepted.
// An unknown code is skipped instead of publishing a misleading region.
const REGION_NAMES = new Map([
  ["77", "Москва"], ["97", "Москва"], ["99", "Москва"], ["177", "Москва"], ["197", "Москва"], ["777", "Москва"], ["799", "Москва"],
  ["50", "Московская область"], ["90", "Московская область"], ["150", "Московская область"], ["190", "Московская область"], ["750", "Московская область"], ["790", "Московская область"],
  ["23", "Краснодарский край"], ["93", "Краснодарский край"], ["123", "Краснодарский край"], ["193", "Краснодарский край"], ["323", "Краснодарский край"],
  ["26", "Ставропольский край"], ["126", "Ставропольский край"],
  ["61", "Ростовская область"], ["161", "Ростовская область"],
  ["66", "Свердловская область"], ["96", "Свердловская область"], ["196", "Свердловская область"],
  ["54", "Новосибирская область"], ["154", "Новосибирская область"],
  ["05", "Республика Дагестан"], ["95", "Чеченская Республика"],
]);

const latinToCyrillic = { A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х", Y: "У", V: "В" };
const normalizeLetter = (letter) => latinToCyrillic[letter.toUpperCase()] ?? letter.toUpperCase();
const decodeHtml = (value) => value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ")
