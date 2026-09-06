import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Пока ключи не добавлены, приложение продолжит работать в режиме демо.
// Service Role key сюда никогда не добавляем: он предназначен только для сервера.
export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        // Браузер использует localStorage, Android — постоянное хранилище
        // приложения. Поэтому вход сохраняется после закрытия сайта или APK.
        storage: Platform.OS === "web" ? undefined : AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === "web",
      },
    })
  : null;
