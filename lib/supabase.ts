import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Пока ключи не добавлены, приложение продолжит работать в режиме демо.
// Service Role key сюда никогда не добавляем: он предназначен только для сервера.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
