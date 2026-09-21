import type { StageKey } from "@/generated/prisma/enums";

// Этапы подбора, которые создаются автоматически для каждой новой компании.
// key — системное обозначение, по нему строится аналитика и цвета.
// Позже администратор сможет добавлять свои этапы: у них key будет пустым.

export const DEFAULT_STAGES: { name: string; key: StageKey }[] = [
  { name: "Новое резюме", key: "NEW" },
  { name: "Первичный контакт", key: "CONTACT" },
  { name: "Скрининг", key: "SCREENING" },
  { name: "Техническое интервью", key: "TECH_INTERVIEW" },
  { name: "Финальное интервью", key: "FINAL_INTERVIEW" },
  { name: "Оффер", key: "OFFER" },
  { name: "Отказ от кандидата", key: "CANDIDATE_DECLINED" },
  { name: "Отказ от нас", key: "WE_DECLINED" },
  { name: "Подумает", key: "CANDIDATE_THINKING" },
  { name: "Не отвечает", key: "NO_RESPONSE" },
  { name: "Подумаем", key: "WE_THINKING" },
];

// Ступени, по которым кандидат движется вперёд. Остальные этапы —
// это выходы из воронки: отказы, паузы, молчание.
export const FUNNEL_KEYS: StageKey[] = [
  "NEW",
  "CONTACT",
  "SCREENING",
  "TECH_INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
];

export type StageTone = "success" | "danger" | "muted" | "active";

// Цвет карточки кандидата зависит от этапа:
//   зелёный — оффер,
//   красный — отказ с нашей стороны,
//   серый   — кандидат ушёл сам или молчит,
//   жёлтый  — работа идёт.
export function stageTone(key: StageKey | null): StageTone {
  if (key === "OFFER" || key === "HIRED") return "success";
  if (key === "WE_DECLINED" || key === "REJECTED") return "danger";
  if (
    key === "CANDIDATE_DECLINED" ||
    key === "NO_RESPONSE" ||
    key === "CANDIDATE_THINKING" ||
    key === "WE_THINKING"
  ) {
    return "muted";
  }
  return "active";
}

// Оформление метки этапа и фона карточки для каждого случая.
export const TONE_STYLES: Record<
  StageTone,
  { badge: string; card: string; border: string }
> = {
  success: {
    badge: "bg-green-100 text-green-800",
    card: "bg-green-50/60",
    border: "border-green-200",
  },
  danger: {
    badge: "bg-red-100 text-red-800",
    card: "bg-red-50/60",
    border: "border-red-200",
  },
  muted: {
    badge: "bg-muted text-ink-soft",
    card: "bg-canvas",
    border: "border-muted",
  },
  active: {
    badge: "bg-accent/25 text-ink",
    card: "bg-accent/5",
    border: "border-accent/30",
  },
};

// Следующая ступень воронки после текущей.
//
// Нужна кнопке «Рекомендую дальше» в календаре: после успешного
// интервью кандидат должен двигаться сам, без похода в его карточку.
// Для этапов вне воронки — «Подумает», «Не отвечает» и прочих —
// следующей ступени нет: куда двигать, решает человек.
export function nextFunnelKey(key: StageKey | null): StageKey | null {
  if (!key) return null;

  const index = FUNNEL_KEYS.indexOf(key);
  if (index === -1 || index === FUNNEL_KEYS.length - 1) {
    return null;
  }

  return FUNNEL_KEYS[index + 1];
}
