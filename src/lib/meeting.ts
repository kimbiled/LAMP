// Ссылка на видеовстречу интервью.
//
// К Google по API не обращаемся: рекрутер создаёт встречу сам
// (кнопка открывает meet.google.com/new) и вставляет ссылку в поле.
// Здесь — только проверка ссылки и поиск её в старых комментариях.

// Новая встреча Google Meet: открывается в Google под учётной записью
// рекрутера, ссылку на комнату он копирует оттуда.
export const NEW_GOOGLE_MEET_URL = "https://meet.google.com/new";

const MAX_LENGTH = 500;

// Пустая строка — «ссылки нет». Иначе только http(s): ссылка
// превращается в кнопку, и «javascript:…» туда попасть не должен.
export function normalizeMeetingUrl(raw: string): string | null | "invalid" {
  const value = raw.trim();
  if (value === "") return null;
  if (value.length > MAX_LENGTH) return "invalid";

  // «meet.google.com/abc-defg-hij» без https:// — частый случай
  // при копировании из приглашения.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return "invalid";
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return "invalid";
  if (!url.hostname.includes(".")) return "invalid";

  return url.toString();
}

// Сервисы видеосвязи, ссылки на которые узнаём в тексте.
const MEETING_HOSTS = [
  "meet.google.com",
  "zoom.us",
  "teams.microsoft.com",
  "teams.live.com",
  "telemost.yandex.ru",
  "meet.jit.si",
];

// До появления отдельного поля ссылку вставляли в комментарий.
// Достаём её оттуда, чтобы у старых встреч тоже была кнопка «Подключиться».
export function meetingUrlFromText(text: string | null): string | null {
  if (!text) return null;

  for (const match of text.matchAll(/https?:\/\/[^\s<>"«»]+/gi)) {
    const candidate = match[0].replace(/[).,;!?]+$/, "");
    try {
      const host = new URL(candidate).hostname.toLowerCase();
      if (MEETING_HOSTS.some((known) => host === known || host.endsWith(`.${known}`))) {
        return candidate;
      }
    } catch {
      // не ссылка — идём дальше
    }
  }

  return null;
}

// Ссылка для кнопки «Подключиться»: из поля, а если его нет — из комментария.
export function joinUrl(interview: {
  meetingUrl: string | null;
  comment: string | null;
}): string | null {
  return interview.meetingUrl ?? meetingUrlFromText(interview.comment);
}
