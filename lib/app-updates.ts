type UpdateTransport = {
  check: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded?: boolean }>;
  fetch: () => Promise<{ isNew: boolean; isRollBackToEmbedded?: boolean }>;
  reload: () => Promise<unknown>;
};

// Download without interrupting a foreground search, form or conversation.
// expo-updates also applies a downloaded compatible update on the next cold start.
export type AppUpdateStatus = { phase: 'idle' | 'checking' | 'downloading' | 'ready' | 'current' | 'error'; message: string; detail?: string };
export function createAppUpdateManager(transport: UpdateTransport, initialState: string | null, now = Date.now, onStatus: (status: AppUpdateStatus) => void = () => {}) {
  let state = initialState;
  let disposed = false;
  let pending = false;
  let checking = false;
  let applying = false;
  let nextCheckAt = 0;
  const status = (phase: AppUpdateStatus['phase'], message: string, error?: unknown) => {
    const detail = error == null ? undefined : String(error).replace(/https?:\/\/[^\s]+/g, '[сервер обновлений]').slice(0, 400);
    if (!disposed) onStatus({phase,message,detail});
  };

  async function applyInBackground() {
    if (disposed || !pending || applying || state !== "background") return;
    applying = true;
    try {
      await transport.reload();
      pending = false;
    } catch {
      status('ready', 'Обновление загружено. Нажми «Применить обновление» или перезапусти приложение.');
      // Keep the downloaded update for a later background event or cold start.
    } finally {
      applying = false;
    }
  }

  async function check(force = false) {
    if (disposed || checking || pending || (!force && now() < nextCheckAt)) return;
    checking = true;
    status('checking', 'Проверяем обновления…');
    try {
      const update = await transport.check();
      if (disposed) return;
      if (update.isAvailable || update.isRollBackToEmbedded) {
        status('downloading', 'Загружаем обновление. Можно продолжать пользоваться приложением.');
        const downloaded = await transport.fetch();
        if (disposed) return;
        pending = downloaded.isNew || !!downloaded.isRollBackToEmbedded;
        if (!pending) throw new Error('Не удалось завершить загрузку обновления.');
      }
      status(pending ? 'ready' : 'current', pending ? 'Обновление загружено. Можно применить его сейчас.' : 'Установлено последнее доступное обновление.');
      nextCheckAt = now() + 15 * 60_000;
      await applyInBackground();
    } catch (error) {
      // A failed check cannot clear the account, cache, or working app version.
      status('error', 'Не удалось получить обновление. Сохранённая версия работает. Повторим автоматически или нажми «Проверить обновления».', error);
      nextCheckAt = now() + 60_000;
    } finally {
      checking = false;
    }
  }

  return {
    check,
    async applyNow() {
      if (disposed || !pending || applying) return;
      applying = true;
      try { await transport.reload(); pending = false; }
      catch { status('ready', 'Не удалось перезапустить приложение. Обновление сохранено — нажми «Применить обновление» ещё раз или закрой и открой приложение.'); }
      finally { applying = false; }
    },
    async changeState(nextState: string) {
      const previous = state;
      state = nextState;
      if (nextState === "background") await applyInBackground();
      if (nextState === "active" && previous !== "active") await check();
    },
    dispose() { disposed = true; },
  };
}
