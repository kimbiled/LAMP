// Единое форматирование дат по всему проекту.
// Часовой пояс задаётся в файле .env — чтобы после публикации в интернет
// время показывалось ваше, а не время сервера.

const TIME_ZONE = process.env.APP_TIMEZONE || "Europe/Moscow";

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
