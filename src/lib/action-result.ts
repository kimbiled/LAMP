// Ответ быстрого действия (сменить этап, роль, статус вакансии).
//
// Раньше такие действия при отказе просто молча выходили, и человек
// не узнавал, что ничего не сохранилось. Теперь действие всегда
// говорит, чем закончилось, а интерфейс показывает это сообщением.

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export function done(message?: string): ActionResult {
  return { ok: true, message };
}

export function fail(error: string): ActionResult {
  return { ok: false, error };
}
