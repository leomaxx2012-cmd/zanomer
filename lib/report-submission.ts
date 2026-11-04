export function reportReasonError(reason: string): string | null {
  const length = Array.from(reason.trim()).length;
  if (length < 3) return "Опиши причину жалобы подробнее — минимум 3 символа.";
  if (length > 500) return "Сократи причину жалобы до 500 символов.";
  return null;
}

export function reportSubmissionError(error: { code?: string; message?: string }, target: "message" | "comment"): string {
  if (error.code === "23505") return target === "message" ? "Ты уже отправил жалобу на это сообщение." : "Ты уже отправил жалобу на этот комментарий.";
  if (error.code === "23514") return "Причина жалобы должна содержать от 3 до 500 символов.";
  if (error.code === "23503") return target === "message" ? "Сообщение уже удалено. Отправить жалобу на него нельзя." : "Комментарий уже удалён. Отправить жалобу на него нельзя.";
  if (error.message?.includes("на себя") || error.message?.includes("на самого себя")) return "Нельзя пожаловаться на самого себя.";
  if (error.code === "42501" && target === "message") return "Можно пожаловаться только на сообщение, полученное от собеседника.";
  if (error.code === "42501" || error.code === "PGRST301" || error.code === "PGRST303") return "Проверь вход в аккаунт и попробуй ещё раз. Текст жалобы сохранён.";
  return "Не удалось отправить жалобу. Текст сохранён — попробуй ещё раз.";
}
