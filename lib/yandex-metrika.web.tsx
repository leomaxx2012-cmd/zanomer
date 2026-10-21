import { useEffect } from "react";

type MetrikaQueue = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

export default function YandexMetrika() {
  useEffect(() => {
    if (window.location.hostname !== "zanomerom.ru") return;
    if (document.getElementById("zanomerom-metrika")) return;

    const target = window as Window & { ym?: MetrikaQueue };
    if (!target.ym) {
      const queue: MetrikaQueue = (...args) => { (queue.a ??= []).push(args); };
      queue.l = Date.now();
      target.ym = queue;
    }

    let referrer = "";
    try { referrer = document.referrer ? new URL(document.referrer).origin : ""; } catch {}
    // Ссылки входа и восстановления могут содержать коды: query и hash не отправляем.
    target.ym(113717207, "init", {
      url: window.location.origin + window.location.pathname,
      referrer,
      title: "ЗаНомером",
      webvisor: false,
      clickmap: false,
      trackLinks: false,
      trackHash: false,
      accurateTrackBounce: true,
    });

    const script = document.createElement("script");
    script.id = "zanomerom-metrika";
    script.async = true;
    script.src = "https://mc.yandex.ru/metrika/tag.js?id=113717207";
    document.head.appendChild(script);
  }, []);

  return null;
}
