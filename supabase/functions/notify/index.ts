import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

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
  } else if (kind === "report" || kind === "comment-report") {
    const table = kind === "report" ? "listing_message_reports" : "listing_public_comment_reports";
    const { data: report } = await admin.from(table).select("reporter_id").eq("id", id).single();
    if (!report || report.reporter_id !== user.id) return Response.json({ error: "Forbidden" }, { status: 403, headers });
    const { data: moderators } = await admin.from("auto_moderators").select("user_id");
    recipientIds = (moderators ?? []).map((item) => item.user_id); title = "Новая жалоба"; body = "Требуется проверка жалобы в ЗаНомером";
  } else return Response.json({ error: "Unknown notification" }, { status: 400, headers });
  const { data: tokens } = recipientIds.length ? await admin.from("auto_push_tokens").select("token").in("owner_id", recipientIds) : { data: [] };
  const messages = (tokens ?? []).map(({ token }) => ({ to: token, sound: "default", title, body, data: { kind, id } }));
  if (messages.length) await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(messages) });
  return Response.json({ sent: messages.length }, { headers });
});
