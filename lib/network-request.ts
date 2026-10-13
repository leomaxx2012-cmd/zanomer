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
