// Единое форматирование дат по всему проекту.
// Часовой пояс задаётся в файле .env — чтобы после публикации в интернет
// время показывалось ваше, а не время сервера.

import { APP_TIMEZONE as TIME_ZONE } from "@/lib/time";

export function formatDate(value: Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(value);
}

export function formatDateTime(value: Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(value);
}

import { CURRENCY_SYMBOLS } from "@/lib/labels";

export function formatMoney(value: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${new Intl.NumberFormat("ru-RU").format(value)} ${symbol}`;
}

// Зарплатная вилка: «от 500 000 ₸», «до 800 000 ₸» или диапазон.
export function formatSalary(
  min: number | null,
  max: number | null,
  currency: string,
): string {
  if (min === null && max === null) return "Не указана";
  if (min !== null && max === null) return `от ${formatMoney(min, currency)}`;
  if (min === null && max !== null) return `до ${formatMoney(max, currency)}`;
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const fmt = new Intl.NumberFormat("ru-RU");
  return `${fmt.format(min as number)} – ${fmt.format(max as number)} ${symbol}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

// Правильное окончание после числа: 1 кандидат, 2 кандидата, 5 кандидатов.
export function plural(
  count: number,
  forms: [string, string, string],
): string {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export const CANDIDATE_FORMS: [string, string, string] = [
  "кандидат",
  "кандидата",
  "кандидатов",
];
