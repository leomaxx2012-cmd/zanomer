// Inspect only the response to the owner-approved public URL. Never retry
// against alternative hosts, login endpoints or private APIs.
export function validatePublicResponse(response, html) {
  if (response.status >= 300 && response.status < 400) {
    throw new Error("VK_PUBLIC_REDIRECT: VK redirected the public request; import stopped without following the redirect.");
  }
  if (!response.ok) throw new Error(`VK_HTTP_ERROR: HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error("VK_UNEXPECTED_RESPONSE: expected a public HTML page.");
  }
  if (/captcha|access denied|доступ ограничен|доступ запрещ[её]н|проверка браузера/i.test(html)) {
    throw new Error("VK_PUBLIC_ACCESS_BLOCKED: public access is restricted; no bypass or catalog changes were attempted.");
  }
  // A case-sensitive substring check rejected escaped/capitalized URLs.
  const decoded = html.replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\//g, "/");
  if (!/aautonomera777/i.test(decoded)) {
    throw new Error("VK_PUBLIC_COMMUNITY_UNAVAILABLE: the response does not identify the permitted community; public posts cannot be verified.");
  }
  if (!/(?:id|data-post-id)=["'](?:post)?(-?\d+_\d+)["']/i.test(decoded)) {
    throw new Error("VK_PUBLIC_POSTS_UNAVAILABLE: community identified, but no readable public posts were returned; import was not treated as successful.");
  }
  return decoded;
}
