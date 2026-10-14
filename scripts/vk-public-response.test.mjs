import test from "node:test";
import assert from "node:assert/strict";
import { validatePublicResponse } from "./vk-public-response.mjs";
const response = (status = 200, type = "text/html") => new Response("", { status, headers: { "content-type": type } });
test("accepts public community with actual posts", () => {
  const html = '<a href="https://vk.ru/AAUTONOMERA777"></a><div id="post-123_4">';
  assert.equal(validatePublicResponse(response(), html), html);
});
test("decodes escaped community URLs", () => {
  assert.match(validatePublicResponse(response(), '\\u0061autonomera777<div data-post-id="-123_4">'), /aautonomera777/);
});
test("does not treat absent posts as success", () => {
  assert.throws(() => validatePublicResponse(response(), "aautonomera777"), /VK_PUBLIC_POSTS_UNAVAILABLE/);
});
test("rejects login, restrictions, redirects and non-HTML", () => {
  assert.throws(() => validatePublicResponse(response(), "login form"), /VK_PUBLIC_COMMUNITY_UNAVAILABLE/);
  assert.throws(() => validatePublicResponse(response(), "captcha"), /VK_PUBLIC_ACCESS_BLOCKED/);
  assert.throws(() => validatePublicResponse(response(302), ""), /VK_PUBLIC_REDIRECT/);
  assert.throws(() => validatePublicResponse(response(200, "application/json"), "{}"), /VK_UNEXPECTED_RESPONSE/);
});

test('redirect diagnosis omits sensitive URL components', () => {
  const redirected = new Response('', { status: 302, headers: { location: 'https://user:password@vk.ru/login?token=secret#fragment' } });
  assert.throws(() => validatePublicResponse(redirected, ''), error => {
    assert.match(error.message, /destination https:\/\/vk.ru\/login/);
    assert.doesNotMatch(error.message, /password|secret|fragment/);
    return true;
  });
});
