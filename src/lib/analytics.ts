import type { StageKey } from "@/generated/prisma/enums";

// Расчёты для страницы аналитики. Отдельно от страницы, чтобы их
// можно было проверить тестами без базы.

// Старые этапы компаний, созданных до перестройки воронки, считаются
// вместе с новыми: «Интервью назначено» — это скрининг и т. д.
export const LEGACY_ALIASES: Partial<Record<StageKey, StageKey[]>> = {
  SCREENING: ["INTERVIEW_SCHEDULED"],
  TECH_INTERVIEW: ["INTERVIEW_DONE"],
  OFFER: ["HIRED"],
};

// Медиана, а не среднее: один кандидат, которого вели полгода,
// не должен делать «типичный срок» вдвое длиннее.
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

const DAY = 24 * 60 * 60 * 1000;

// Сколько дней от добавления кандидата до первого перехода в оффер.
export function daysToOffer(
  candidates: { id: string; createdAt: Date }[],
  offerReachedAt: Map<string, Date>,
): number[] {
  const result: number[] = [];
  for (const candidate of candidates) {
    const at = offerReachedAt.get(candidate.id);
    if (!at) continue;
    result.push(Math.max(0, Math.round((at.getTime() - candidate.createdAt.getTime()) / DAY)));
  }
  return result;
}
