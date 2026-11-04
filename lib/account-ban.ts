export type BanUnit = "minutes" | "hours" | "days";
export type AccountBan = { reason: string; expires_at: string | null; created_at: string };
export type BanNotice = AccountBan & { id: string; owner_id: string };

export function banDurationMinutes(value: string, unit: BanUnit, permanent: boolean): number | null {
  if (permanent) return null;
  const count = /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  const minutes = count * ({ minutes: 1, hours: 60, days: 1440 }[unit]);
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 52560000) {
    throw new Error("Укажи целое положительное число. Максимальный срок — 100 лет.");
  }
  return minutes;
}

export function banExpiryText(expiresAt: string | null): string {
  if (!expiresAt) return "Бессрочно";
  return `До ${new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(expiresAt))} (МСК)`;
}
