export function createTimeoutFetch(transport: typeof fetch, timeoutMs = 15_000): typeof fetch {
  return async (input, options) => {
    const controller = new AbortController();
    const upstream = options?.signal;
    const cancel = () => controller.abort();
    if (upstream?.aborted) cancel();
    else upstream?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(cancel, timeoutMs);
    try {
      return await transport(input, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      upstream?.removeEventListener('abort', cancel);
    }
  };
}

// A captive portal/VPN may return HTML with a 403 or even 200 status. Such a
// response is not an auth-server decision to revoke the refresh token. Throwing
// a transport error lets Supabase keep its saved session and retry. Genuine JSON
// auth errors are passed through, including revoked/expired refresh tokens.
export function createSessionSafeFetch(transport: typeof fetch): typeof fetch {
  return async (input, options) => {
    const response = await transport(input, options);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token')) {
      if ([408, 429].includes(response.status) || response.status >= 500) {
        throw new TypeError('Session refresh temporarily unavailable');
      }
      let payload: Record<string, unknown>;
      try {
        payload = await response.clone().json();
      } catch {
        throw new TypeError('Unexpected network response during session refresh');
      }
      const authResponse = payload && typeof payload === 'object' && (
        (response.ok && typeof payload.access_token === 'string' && typeof payload.refresh_token === 'string') ||
        (!response.ok && (typeof payload.error === 'string' || typeof payload.error_code === 'string' || typeof payload.code === 'string'))
      );
      if (!authResponse) throw new TypeError('Unexpected session refresh response');
    }
    return response;
  };
}
