// Шаблон приглашения на интервью — общий для компании. Рекрутер
// копирует его кнопкой в форме интервью и отправляет кандидату
// в WhatsApp, Telegram или почту. Менять шаблон могут администратор
// и рекрутер в «Настройках».
//
// Метки пишутся в квадратных скобках: [Имя], [Дата], [Ссылка] —
// при копировании они заменяются данными встречи. Фигурные скобки
// {имя} тоже понимаем — так был устроен первый вариант шаблона.
//
// Блоки «Если онлайн:» и «Если офлайн:» (до пустой строки) остаются
// только тот, что подходит: что выбрано переключателем «Онлайн /
// В офисе» в форме интервью. Сами строки «Если онлайн:» в текст
// не попадают.

export type InviteKey =
  | "name"
  | "company"
  | "position"
  | "date"
  | "time"
  | "duration"
  | "format"
  | "link"
  | "address"
  | "room"
  | "recruiter";

// Метка, как её пишут в тексте → что подставить. Сравниваем без учёта
// регистра и лишних пробелов.
const ALIASES: Record<string, InviteKey> = {
  "имя": "name",
  "название компании": "company",
  "компания": "company",
  "название должности": "position",
  "должность": "position",
  "вакансия": "position",
  "дата": "date",
  "время": "time",
  "длительность": "duration",
  "онлайн / офлайн": "format",
  "онлайн/офлайн": "format",
  "формат": "format",
  "ссылка": "link",
  "адрес": "address",
  "номер кабинета": "room",
  "кабинет": "room",
  "рекрутер": "recruiter",
};

// Подсказки к меткам в «Настройках»: нажатием метка добавляется в текст.
export const INVITE_PLACEHOLDERS = [
  { label: "Имя", hint: "имя кандидата" },
  { label: "Название компании", hint: "из настроек компании" },
  { label: "Название должности", hint: "вакансия кандидата" },
  { label: "Дата", hint: "например 12 ноября, четверг" },
  { label: "Время", hint: "например 15:00" },
  { label: "Онлайн / Офлайн", hint: "по переключателю в форме интервью" },
  { label: "Ссылка", hint: "ссылка на Google Meet" },
  { label: "Адрес", hint: "адрес офиса из настроек" },
  { label: "Номер кабинета", hint: "кабинет из настроек" },
  { label: "Рекрутер", hint: "имя того, кто копирует" },
] as const;

export const DEFAULT_INVITE_TEMPLATE = `Здравствуйте, [Имя]!

Приглашаем вас на интервью в компанию [Название компании] на позицию [Название должности].

Детали встречи:

• Дата: [Дата]
• Время: [Время]
• Формат: [Онлайн / Офлайн]

Если онлайн:
Ссылка для подключения: [Ссылка]

Если офлайн:
Адрес: [Адрес]
Кабинет: [Номер кабинета]

Пожалуйста, подтвердите своё участие.`;

export const MAX_TEMPLATE_LENGTH = 3000;

function keyOf(raw: string): InviteKey | null {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return ALIASES[normalized] ?? null;
}

// Оставить только подходящий блок «Если онлайн / Если офлайн».
function pickFormatBlocks(text: string, online: boolean): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let mode: "online" | "offline" | null = null;

  for (const line of lines) {
    const header = line.trim().toLowerCase().replace(/\s+/g, " ");
    if (/^если онлайн:?$/.test(header)) {
      mode = "online";
      continue;
    }
    if (/^если офлайн:?$/.test(header)) {
      mode = "offline";
      continue;
    }
    if (line.trim() === "") mode = null;

    if (mode === "online" && !online) continue;
    if (mode === "offline" && online) continue;
    result.push(line);
  }
  return result.join("\n");
}

// Подставляет значения. Строка вида «Подпись: [метка]», у которой
// значения нет, убирается целиком: «Кабинет:» без номера в письме
// ни к чему.
export function fillInviteTemplate(
  template: string,
  values: Partial<Record<InviteKey, string | null | undefined>>,
  // Что выбрано переключателем «Онлайн / В офисе». Не передали —
  // решаем по ссылке, как раньше.
  options: { online?: boolean } = {},
): string {
  const source = template.trim() ? template : DEFAULT_INVITE_TEMPLATE;
  const online = options.online ?? Boolean(values.link?.trim());
  const withFormat: Partial<Record<InviteKey, string | null | undefined>> = {
    ...values,
    format: values.format ?? (online ? "Онлайн" : "Офлайн"),
  };

  const result: string[] = [];
  for (const line of pickFormatBlocks(source, online).split("\n")) {
    let empty = false;
    const filled = line.replace(/\[([^[\]]+)\]|\{([^{}]+)\}/g, (whole, square, curly) => {
      const key = keyOf(square ?? curly);
      if (!key) return whole;
      const value = withFormat[key]?.trim();
      if (!value) {
        empty = true;
        return "";
      }
      return value;
    });

    // «• Кабинет:» без значения — строку целиком убираем.
    if (empty && /^[•\-–\s]*[^:]{0,40}:\s*(\([^)]*\))?\s*$/.test(filled.trim())) continue;

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
