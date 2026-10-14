// Exactly one request, for the only owner-approved community. Never fall back
// to HTML after an API error, and never follow authentication redirects.
export async function loadVkApiPosts(token, signal, transport = fetch) {
  if (!token?.trim()) throw new Error('VK_API_TOKEN_MISSING');
  const response = await transport('https://api.vk.com/method/wall.get', {
    method: 'POST', redirect: 'manual', signal,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      access_token: token.trim(), v: '5.199', domain: 'aautonomera777',
      filter: 'owner', count: '100', extended: '0',
    }),
  });
  if (!response.ok) throw new Error(`VK_API_HTTP_ERROR: HTTP ${response.status}`);
  const payload = await response.json();
  // Do not log the request parameters echoed by VK, which include the token.
  if (payload.error) throw new Error(`VK_API_ERROR: code ${Number(payload.error.error_code) || 'unknown'}`);
  if (!Array.isArray(payload.response?.items)) throw new Error('VK_API_INVALID_RESPONSE');
  const posts = [];
  for (const item of payload.response.items) {
    if (!Number.isSafeInteger(item.owner_id) || item.owner_id >= 0 || !Number.isSafeInteger(item.id) || item.id <= 0) continue;
    if (item.is_deleted || typeof item.text !== 'string' || !Number.isFinite(item.date)) continue;
    const postedAt = new Date(item.date * 1000);
    if (!Number.isFinite(postedAt.getTime())) continue;
    const text = item.text;
    posts.push({
      postId: `${item.owner_id}_${item.id}`, text, postedAt: postedAt.toISOString(),
      sold: /(?:^|[^\p{L}])(продан[аоы]?|продали|забронирован[аоы]?|зарезервирован[аоы]?|в резерве|снят[аоы]? с продажи|нет в наличии)(?:$|[^\p{L}])/iu.test(text),
    });
  }
  return [...new Map(posts.map(post => [post.postId, post])).values()];
}
