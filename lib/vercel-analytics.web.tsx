import { Analytics } from "@vercel/analytics/react";

// Vercel автоматически собирает посещения и просмотры страниц после деплоя.
export default function VercelAnalytics() {
  return <Analytics />;
}
