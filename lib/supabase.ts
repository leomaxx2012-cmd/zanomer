import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Каталог должен работать и в APK, собранном вне EAS/Vercel. Metro иногда не
// передаёт EXPO_PUBLIC_* из GitHub Actions в release-бандл, из-за чего APK
// ошибочно открывался с 18 демо-карточками. Эти значения — публичные данные
// клиента Supabase (не service-role ключ) и уже доступны в веб-приложении.
const DEFAULT_SUPABASE_URL = "https://qiqnbjdgkhbtfpxqtpio.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_F-nhmdzQnvxe3stusjD-NA_i1-AOXOB";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

// Service Role key сюда никогда не добавляем: он предназначен только для сервера.
export const supabase = createClient(url, anonKey, {
      auth: {
        // Браузер использует localStorage, Android — постоянное хранилище
        // приложения. Поэтому вход сохраняется после закрытия сайта или APK.
        storage: Platform.OS === "web" ? undefined : AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === "web",
      },
    });
