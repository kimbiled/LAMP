// Ссылки для быстрой связи с кандидатом.
// Никаких интеграций: это обычные ссылки, которые открывают
// телефон, WhatsApp, Telegram или почтовую программу.

export function phoneDigits(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
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

export function telegramLink(value: string | null): string | null {
  const username = normalizeTelegram(value);
  return username ? `https://t.me/${username}` : null;
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
