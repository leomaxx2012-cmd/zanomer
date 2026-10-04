import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const services = {
  plus_month: { title: "Подписка ЗаНомером Плюс на месяц", amount: 19900 },
  highlight_48h: { title: "Выделение объявления на 48 часов", amount: 12900 },
  highlight_pack_5: { title: "Пакет из 5 выделений", amount: 49900 },
  hot_listing: { title: "Горячее предложение", amount: 39900 },
  hot_pack_5: { title: "Пакет из 5 горячих размещений", amount: 159900 },
} as const;

type ServiceCode = keyof typeof services;

function basicAuth(shopId: string, secret: string) {
  return `Basic ${btoa(`${shopId}:${secret}`)}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const shopId = Deno.env.get("YOOKASSA_SHOP_ID");
  const secret = Deno.env.get("YOOKASSA_SECRET_KEY");
  if (!shopId || !secret) return Response.json({ error: "Payment service is not configured" }, { status: 503, headers });

  const userClient = createClient(url, anon, { global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers });

  const body = await request.json().catch(() => ({}));
  const serviceCode = String(body.serviceCode ?? "") as ServiceCode;
  const service = services[serviceCode];
  if (!service) return Response.json({ error: "Unknown service" }, { status: 400, headers });

  const origin = request.headers.get("origin") || "https://zanomerom.ru";
  const safeOrigin = /^https:\/\/(?:www\.)?zanomerom\.ru$/.test(origin) ? origin : "https://zanomerom.ru";
  const idempotenceKey = crypto.randomUUID();
  const providerResponse = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: { Authorization: basicAuth(shopId, secret), "Content-Type": "application/json", "Idempotence-Key": idempotenceKey },
    body: JSON.stringify({
      amount: { value: (service.amount / 100).toFixed(2), currency: "RUB" },
      confirmation: { type: "redirect", return_url: `${safeOrigin}/?payment=return` },
      capture: true,
      description: service.title,
      metadata: { user_id: user.id, service_code: serviceCode, app: "zanomerom" },
    }),
  });
  const providerPayment = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok || !providerPayment?.id || !providerPayment?.confirmation?.confirmation_url) {
    return Response.json({ error: "Could not create payment" }, { status: 502, headers });
  }

  const admin = createClient(url, serviceRole);
  const { error } = await admin.from("service_payments").insert({
    owner_id: user.id,
    provider_payment_id: providerPayment.id,
    service_code: serviceCode,
    amount_kopecks: service.amount,
    confirmation_url: providerPayment.confirmation.confirmation_url,
  });
  if (error) return Response.json({ error: "Could not save payment" }, { status: 500, headers });
  return Response.json({ confirmationUrl: providerPayment.confirmation.confirmation_url }, { headers });
});
