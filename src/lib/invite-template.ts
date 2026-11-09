// Шаблон приглашения на интервью, который рекрутер копирует кнопкой
// и отправляет кандидату в WhatsApp, Telegram или почту.
//
// В тексте можно писать метки в фигурных скобках — при копировании
// они заменяются данными встречи. Шаблон у каждого свой, меняется
// в «Настройках». Пустой — используется этот, по умолчанию.

export const INVITE_PLACEHOLDERS = [
  { key: "имя", hint: "имя кандидата" },
  { key: "вакансия", hint: "название вакансии" },
  { key: "дата", hint: "день встречи, например 12 ноября, среда" },
  { key: "время", hint: "время начала, например 15:00" },
  { key: "длительность", hint: "например 45 минут" },
  { key: "ссылка", hint: "ссылка на Google Meet" },
  { key: "компания", hint: "название вашей компании" },
  { key: "рекрутер", hint: "ваше имя" },
] as const;

export type InviteKey = (typeof INVITE_PLACEHOLDERS)[number]["key"];

export const DEFAULT_INVITE_TEMPLATE = `Здравствуйте, {имя}!

Приглашаем вас на интервью на вакансию «{вакансия}» в компанию {компания}.

Дата: {дата}
Время: {время} (по времени Астаны)
Длительность: {длительность}
Ссылка на встречу: {ссылка}

Если время неудобно, напишите — подберём другое.

С уважением,
{рекрутер}`;

export const MAX_TEMPLATE_LENGTH = 3000;

// Подставляет значения. Строка вида «Подпись: {метка}», у которой
// значения нет, убирается целиком: «Ссылка на встречу:» без ссылки
// в письме ни к чему.
export function fillInviteTemplate(
  template: string,
  values: Partial<Record<InviteKey, string | null | undefined>>,
): string {
  const source = template.trim() ? template : DEFAULT_INVITE_TEMPLATE;
  const result: string[] = [];

  for (const line of source.split("\n")) {
    let empty = false;
    const filled = line.replace(/\{([^{}]+)\}/g, (whole, raw: string) => {
      const key = raw.trim().toLowerCase() as InviteKey;
      if (!INVITE_PLACEHOLDERS.some((item) => item.key === key)) return whole;
      const value = values[key]?.trim();
      if (!value) {
        empty = true;
        return "";
      }
      return value;
    });

    if (empty && /^[^:]{0,40}:\s*(\([^)]*\))?\s*$/.test(filled.trim())) continue;

    result.push(
      empty
        ? filled
            .replace(/«\s*»/g, "")
            .replace(/\s+([,.!?])/g, "$1")
            .replace(/\s{2,}/g, " ")
            .trimEnd()
        : filled,
    );
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
