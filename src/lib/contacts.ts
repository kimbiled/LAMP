// Ссылки для быстрой связи с кандидатом.
// Никаких интеграций: это обычные ссылки, которые открывают
// телефон, WhatsApp, Telegram или почтовую программу.

export function phoneDigits(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

// Ключ для сравнения номеров. Один и тот же телефон пишут как
// +7 701 123 45 67, 8 701 123 45 67 и 7011234567 — по последним десяти
// цифрам все три совпадают, а код страны и формат уже не мешают.
export function phoneKey(phone: string | null): string | null {
  const digits = phoneDigits(phone);
  return digits ? digits.slice(-10) : null;
}

export function telLink(phone: string | null): string | null {
  const digits = phoneDigits(phone);
  return digits ? `tel:+${digits}` : null;
}

export function whatsappLink(
  phone: string | null,
  message?: string,
): string | null {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${query}`;
}

// Ник может быть записан как @ivan, ivan или https://t.me/ivan —
// приводим к одному виду.
export function normalizeTelegram(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .trim()
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");
  return cleaned === "" ? null : cleaned;
}

// Ссылка на чат в Telegram.
//
// Если ника нет, но есть телефон — открываем чат по номеру: Telegram
// сам находит человека, если этот номер у него зарегистрирован.
// Формат t.me/+77011234567 работает и в браузере, и в приложении.
export function telegramLink(
  value: string | null,
  phone?: string | null,
): string | null {
  const username = normalizeTelegram(value);
  if (username) {
    return `https://t.me/${username}`;
  }

  const digits = phoneDigits(phone ?? null);
  return digits ? `https://t.me/+${digits}` : null;
}

// По нику чат откроется наверняка, по телефону — только если номер
// зарегистрирован в Telegram. Об этом стоит предупредить в подсказке.
export function telegramByPhoneOnly(
  value: string | null,
  phone?: string | null,
): boolean {
  return !normalizeTelegram(value) && Boolean(phoneDigits(phone ?? null));
}

export function emailLink(email: string | null): string | null {
  return email ? `mailto:${email}` : null;
}

// Заготовка первого сообщения в WhatsApp.
export function firstMessage(params: {
  candidateName: string;
  recruiterName: string;
  companyName: string;
  jobTitle?: string | null;
}): string {
  // ФИО пишется как «Петров Иван Сергеевич», поэтому имя — второе слово.
  const parts = params.candidateName.trim().split(/\s+/);
  const firstName = parts.length > 1 ? parts[1] : parts[0];

  const about = params.jobTitle
    ? `по поводу вакансии «${params.jobTitle}»`
    : "по поводу вакансии";

  return `Здравствуйте, ${firstName}! Меня зовут ${params.recruiterName}, я рекрутер компании ${params.companyName}. Пишу ${about}.`;
}
