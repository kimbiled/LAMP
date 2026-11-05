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

// Оформление этапа: метка, фон карточки и рамка.
//
// Фон у всех случаев одинаковый — почти белый. Это не упущение:
// раньше тон заливал карточку целиком, и у кандидата на обычном этапе
// шапка со всеми контактами становилась сплошь жёлтой. Этап — это одно
// слово о человеке, а не повод перекрасить пол-экрана.
//
// Поэтому цвет этапа живёт в маленькой метке, а рамка остаётся
// нейтральной: жёлтым и хаки обводятся только выбранные элементы
// и действия, иначе подсветка перестаёт что-либо значить.
export const TONE_STYLES: Record<
  StageTone,
  { badge: string; card: string; border: string }
> = {
  success: {
    badge: "bg-success-soft text-success-ink",
    card: "bg-surface",
    border: "border-khaki-line",
  },
  danger: {
    badge: "bg-danger-soft text-danger-ink",
    card: "bg-surface",
    border: "border-danger-line",
  },
  muted: {
    badge: "bg-muted text-ink-soft",
    card: "bg-surface",
    border: "border-line",
  },
  active: {
    badge: "bg-warning-soft text-ink",
    card: "bg-surface",
    border: "border-line",
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

// Группы этапов для выбора: движение вперёд, пауза, конец подбора.
export type StageGroup = "progress" | "pause" | "closed";

export const STAGE_GROUPS: { id: StageGroup; label: string }[] = [
  { id: "progress", label: "В работе" },
  { id: "pause", label: "Пауза" },
  { id: "closed", label: "Отказ" },
];

export function stageGroup(key: StageKey | null): StageGroup {
  if (
    key === "CANDIDATE_THINKING" ||
    key === "WE_THINKING" ||
    key === "NO_RESPONSE"
  ) {
    return "pause";
  }
  if (key === "CANDIDATE_DECLINED" || key === "WE_DECLINED" || key === "REJECTED") {
    return "closed";
  }
  // Свои этапы компании (без key) и все ступени воронки, включая «Принят».
  return "progress";
}
