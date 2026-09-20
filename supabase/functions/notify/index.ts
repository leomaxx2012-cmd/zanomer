import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function matchesSearchAlert(listing: Record<string, unknown>, alert: Record<string, unknown>) {
  const matchesPattern = (value: unknown, pattern: unknown) => {
    const clean = String(pattern ?? "").trim().toUpperCase();
    if (!clean) return true;
    const actual = String(value ?? "").toUpperCase();
    if (!clean.includes("*")) return actual.includes(clean);
    const parts = clean.split("*");
    let position = 0;
    for (const part of parts) {
      if (!part) continue;
      const found = actual.indexOf(part, position);
      if (found < 0) return false;
      position = found + part.length;
    }
    return true;
  };
  const region = String(listing.region ?? "");
  const regionCode = region.split(" · ").at(-1)?.trim() ?? "";
  const selectedCodes = String(alert.region_code ?? "").split(",").map((code) => code.trim()).filter(Boolean);
  const matchesRegion = selectedCodes.length > 0 || alert.region === "Все" || region.startsWith(String(alert.region ?? ""));
  return matchesPattern(listing.plate_left, alert.left_letter)
    && matchesPattern(listing.plate_right, alert.right_letters)
    && matchesPattern(listing.plate_digits, alert.digits)
    && (selectedCodes.length === 0 || selectedCodes.includes(regionCode))
    && matchesRegion
    && (!alert.vehicle_type || alert.vehicle_type === listing.vehicle_type)
    && (!alert.price_limit || Number(listing.price_rub) <= Number(alert.price_limit));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  const auth = request.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  const { kind, id } = await request.json();
  const admin = createClient(url, service);
  let recipientIds: string[] = [], title = "ЗаНомером", body = "Новое уведомление";
  if (kind === "message") {
    const { data: message } = await admin.from("listing_messages").select("sender_id, recipient_id, listing_id").eq("id", id).single();
    if (!message || message.sender_id !== user.id) return Response.json({ error: "Forbidden" }, { status: 403, headers });
    recipientIds = [message.recipient_id]; title = "Новое сообщение"; body = "Вам написали по объявлению";
  } else if (kind === "comment") {
    const { data: comment } = await admin.from("listing_public_comments").select("author_id, listing_id").eq("id", id).single();
    if (!comment || comment.author_id !== user.id) return Response.json({ error: "Forbidden" }, { status: 403, headers });
    const { data: listing } = await admin.from("auto_listings").select("owner_id").eq("id", comment.listing_id).single();
    if (listing?.owner_id && listing.owner_id !== user.id) recipientIds = [listing.owner_id];
    title = "Новый комментарий"; body = "К вашему объявлению оставили комментарий";
  } else if (kind === "search-alert") {
    const { data: listing } = await admin
      .from("auto_listings")
      .select("id, owner_id, plate_left, plate_digits, plate_right, region, vehicle_type, price_rub, status")
      .eq("id", id)
      .single();
    if (!listing || listing.status !== "active") return Response.json({ error: "Listing is not active" }, { status: 400, headers });
    const isOwner = listing.owner_id === user.id;
    const { data: moderator } = isOwner ? { data: null } : await admin.from("auto_moderators").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!isOwner && !moderator) return Response.json({ error: "Forbidden" }, { status: 403, headers });
    const { data: alerts } = await admin
      .from("auto_search_alerts")
      .select("owner_id,left_letter,right_letters,digits,region,region_code,vehicle_type,price_limit")
      .eq("enabled", true);
    const searchAlerts = (alerts ?? []) as Array<Record<string, unknown> & { owner_id: string }>;
    recipientIds = [...new Set(searchAlerts
      .filter((alert) => alert.owner_id !== listing.owner_id && matchesSearchAlert(listing, alert))
      .map((alert) => alert.owner_id))];
    title = "Подходящий номер появился";
    body = `${listing.plate_left} ${listing.plate_digits} ${listing.plate_right} · ${listing.region}`;
  } else if (kind === "report" || kind === "comment-report") {
    const table = kind === "report" ? "listing_message_reports" : "listing_public_comment_reports";
    const { data: report } = await admin.from(table).select("reporter_id").eq("id", id).single();
    if (!report || report.reporter_id !== user.id) return Response.json({ error: "Forbidden" }, { status: 403, headers });
    const { data: moderators } = await admin.from("auto_moderators").select("user_id");
    recipientIds = (moderators ?? []).map((item) => item.user_id); title = "Новая жалоба"; body = "Требуется проверка жалобы в ЗаНомером";
  } else return Response.json({ error: "Unknown notification" }, { status: 400, headers });
  const { data: tokens } = recipientIds.length ? await admin.from("auto_push_tokens").select("token").in("owner_id", recipientIds) : { data: [] };
  const messages = (tokens ?? []).map(({ token }) => ({ to: token, sound: "default", title, body, priority: "high", channelId: "matches", ttl: 3600, data: { kind, id } }));
  if (messages.length) await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(messages) });
  return Response.json({ sent: messages.length }, { headers });
});
