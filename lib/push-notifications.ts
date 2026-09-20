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

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    // При запуске с нестабильной сетью или VPN токен будет повторно
    // запрошен при следующем входе, без зависания кнопок приложения.
    return { ok: false, reason: "token" as const };
  }

  // У одного аккаунта может быть несколько телефонов. Не удаляем их токены
  // при входе на другом устройстве: каждый действующий телефон должен
  // получать уведомление, как в прежних рабочих версиях приложения.
  const { error } = await supabase.from("auto_push_tokens").upsert({
    token,
    owner_id: userId,
    platform: Platform.OS,
    updated_at: new Date().toISOString(),
  }, { onConflict: "token" });
  return error ? { ok: false, reason: "storage" as const } : { ok: true, token };
}

// Показывает уведомление, пока приложение открыто. Для push при закрытом
// приложении потребуется отдельный защищённый серверный отправитель Expo Push.
export async function showChatNotification(plate: string) {
  if (!Device.isDevice) return;
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return;
  await Notifications.scheduleNotificationAsync({
    content: { title: "Новое сообщение по объявлению", body: `По номеру ${plate} пришло новое сообщение`, sound: "default", data: { kind: "message" }, ...(Platform.OS === "android" ? { channelId: "matches" } : {}) },
    trigger: null,
  });
}

/** Отправляет push через защищённую Supabase Edge Function.
 * Функция сама проверяет права по записи в базе, поэтому токены телефонов
 * и служебные ключи никогда не попадают в приложение. */
export async function sendServerPush(kind: "message" | "comment" | "report" | "comment-report", id: string) {
  if (!supabase || !id) return;
  await supabase.functions.invoke("notify", { body: { kind, id } });
}
