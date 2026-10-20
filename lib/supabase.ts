import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { createTimeoutFetch, createSessionSafeFetch } from "./network-request";
import type { User } from "@supabase/supabase-js";

// Каталог должен работать и в APK, собранном вне EAS/Vercel. Metro иногда не
// передаёт EXPO_PUBLIC_* из GitHub Actions в release-бандл, из-за чего APK
// ошибочно открывался с 18 демо-карточками. Эти значения — публичные данные
// клиента Supabase (не service-role ключ) и уже доступны в веб-приложении.
const DEFAULT_SUPABASE_URL = "https://qiqnbjdgkhbtfpxqtpio.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_F-nhmdzQnvxe3stusjD-NA_i1-AOXOB";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const authStorageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;

// Only restores the local profile display while the SDK refreshes its token.
// All protected operations still require the SDK session and server-side RLS.
export async function readSavedProfile(): Promise<User | null> {
  try {
    const saved = await AsyncStorage.getItem(authStorageKey);
    const session = saved ? JSON.parse(saved) : null;
    return session?.refresh_token && session?.user?.id ? session.user : null;
  } catch {
    return null;
  }
}

// Service Role key сюда никогда не добавляем: он предназначен только для сервера.
export const supabase = createClient(url, anonKey, {
      global: { fetch: createSessionSafeFetch(createTimeoutFetch(fetch)) },
      auth: {
        // Браузер использует localStorage, Android — постоянное хранилище
        // приложения. Поэтому вход сохраняется после закрытия сайта или APK.
        storage: Platform.OS === "web" ? undefined : AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === "web",
      },
    });

// Public listings must not wait for an expired login token or an auth lock.
export const publicCatalogClient = createClient(url, anonKey, {
  global: { fetch: createTimeoutFetch(fetch) },
  auth: { storageKey: 'zanomer-public-catalog', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
