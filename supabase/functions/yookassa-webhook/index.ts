// Разворачивается без проверки JWT: это адрес уведомлений ЮKassa.
// Статус никогда не берётся из тела входящего запроса — его сверяем в API ЮKassa.
import { createClient } from "npm:@supabase/supabase-js@2";

const shopId = Deno.env.get("YOOKASSA_SHOP_ID")!;
const secret = Deno.env.get("YOOKASSA_SECRET_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRole);

function basicAuth() {
  return `Basic ${btoa(`${shopId}:${secret}`)}`;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const event = await request.json().catch(() => null);
  const paymentId = String(event?.object?.id ?? "");
  if (!paymentId || !shopId || !secret) return new Response("Bad request", { status: 400 });

  const response = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: basicAuth() },
  });
  const payment = await response.json().catch(() => null);
  if (!response.ok || !payment?.id) return new Response("Payment lookup failed", { status: 502 });

  const status = payment.status === "succeeded" ? "succeeded" : payment.status === "canceled" ? "canceled" : "pending";
  const { error } = await admin.from("service_payments").update({
    status,
    paid_at: status === "succeeded" ? new Date().toISOString() : null,
  }).eq("provider_payment_id", payment.id);
  return error ? new Response("Update failed", { status: 500 }) : new Response("ok", { status: 200 });
});
