// Ограничивает ожидание интерфейса, но не отменяет запрос на сервере.
// Поэтому отправку письма после тайм-аута не повторяем автоматически.
export async function waitForAuth<T>(request: PromiseLike<T>, timeoutMs = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Сервис входа не ответил вовремя. Проверь интернет. Если запрашивал код, письмо ещё может прийти — не отправляй запрос повторно сразу.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
