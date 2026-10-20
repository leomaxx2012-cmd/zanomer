type UpdateTransport = {
  check: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded?: boolean }>;
  fetch: () => Promise<{ isNew: boolean; isRollBackToEmbedded?: boolean }>;
  reload: () => Promise<unknown>;
};

// Download without interrupting a foreground search, form or conversation.
// expo-updates also applies a downloaded compatible update on the next cold start.
export function createAppUpdateManager(transport: UpdateTransport, initialState: string | null, now = Date.now) {
  let state = initialState;
  let disposed = false;
  let pending = false;
  let checking = false;
  let applying = false;
  let nextCheckAt = 0;

  async function applyInBackground() {
    if (disposed || !pending || applying || state !== "background") return;
    applying = true;
    try {
      await transport.reload();
      pending = false;
    } catch {
      // Keep the downloaded update for a later background event or cold start.
    } finally {
      applying = false;
    }
  }

  async function check() {
    if (disposed || checking || pending || now() < nextCheckAt) return;
    checking = true;
    try {
      const update = await transport.check();
      if (disposed) return;
      if (update.isAvailable || update.isRollBackToEmbedded) {
        const downloaded = await transport.fetch();
        if (disposed) return;
        pending = downloaded.isNew || !!downloaded.isRollBackToEmbedded;
      }
      nextCheckAt = now() + 15 * 60_000;
      await applyInBackground();
    } catch {
      // A failed check cannot clear the account, cache, or working app version.
      nextCheckAt = now() + 60_000;
    } finally {
      checking = false;
    }
  }

  return {
    check,
    async changeState(nextState: string) {
      const previous = state;
      state = nextState;
      if (nextState === "background") await applyInBackground();
      if (nextState === "active" && previous !== "active") await check();
    },
    dispose() { disposed = true; },
  };
}
