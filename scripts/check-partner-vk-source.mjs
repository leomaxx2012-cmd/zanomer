/**
 * A deliberately low-impact availability check for the official VK community
 * that the owner supplied directly. It makes exactly one public request per
 * nightly run and does not bypass login, scrape contacts, or import posts.
 */
const source = {
  name: "АВТОНОМЕРА777",
  url: "https://vk.ru/aautonomera777",
};

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 20_000);

try {
  const response = await fetch(source.url, {
    signal: controller.signal,
    headers: {
      "user-agent": "ZaNomer catalog checker/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const page = await response.text();
  if (!page.includes("aautonomera777")) throw new Error("Public community identifier was not found in the response");
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), source: source.name, status: "available" }));
} finally {
  clearTimeout(timeout);
}
