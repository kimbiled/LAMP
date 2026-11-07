import { formatMonths, periodMonths } from "@/lib/resume/score";

// Правила показа опыта работы. Общие для карточки на экране
// (components/experience-list.tsx) и для выгрузки в PDF
// (lib/pdf/candidate-resume.tsx) — чтобы одно и то же место работы
// не выглядело по-разному в двух местах.

// hh считает месяцы включительно: «Март 2024 — Июль 2026» — это
// 2 года 5 месяцев. Считаем так же, чтобы цифры совпадали с резюме.
export function experienceDuration(period: string | null): string | null {
  const months = periodMonths(period);
  return months > 0 ? formatMonths(months + 1) : null;
}

// Подзаголовок внутри описания: «Достижения:», «Обязанности:».
export const isHeading = (line: string) =>
  line.endsWith(":") && line.length < 50;

// Пункт с номером: «1 - Заменил бумажный учёт…».
export const isNumbered = (line: string) =>
  /^\d{1,2}\s*[-–—.)]\s+\S/.test(line);

// Перечень технологий: «React · TypeScript · Zustand».
export const isTechStack = (line: string) =>
  (line.match(/\s·\s/g) ?? []).length >= 2;

// Описание обязанностей построчно, без пустых строк.
export function descriptionLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
