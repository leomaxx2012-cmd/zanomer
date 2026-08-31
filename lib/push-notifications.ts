import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Запрашивает разрешение и сохраняет Expo Push Token у текущего пользователя.
 * В веб-версии и Expo Go метод безопасно ничего не делает: настоящие push
 * приходят только в собранное Android-приложение на физическом телефоне.
 */
export async function registerForPushNotifications(userId: string) {
  if (!supabase || !userId || !Device.isDevice) return { ok: false, reason: "device" as const };

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("matches", {
      name: "Новые номера",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      sound: "default",
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === "granted"
    ? current
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return { ok: false, reason: "denied" as const };

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return { ok: false, reason: "project" as const };

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.from("auto_push_tokens").upsert({
    token,
    owner_id: userId,
    platform: Platform.OS,
    updated_at: new Date().toISOString(),
  }, { onConflict: "token" });
  return error ? { ok: false, reason: "storage" as const } : { ok: true, token };
}
