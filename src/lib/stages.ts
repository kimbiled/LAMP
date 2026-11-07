import type { StageKey } from "@/generated/prisma/enums";

// Этапы подбора, которые создаются автоматически для каждой новой компании.
// key — системное обозначение, по нему строится аналитика и цвета.
// Администратор добавляет свои этапы в настройках: у них key пустой.

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

// Ступень воронки: системная из FUNNEL_KEYS или своя этап компании
// (у своих key пустой). Паузы, отказы и старые служебные этапы — нет.
export function isProgressStep(key: StageKey | null): boolean {
  return key === null || FUNNEL_KEYS.includes(key);
}

// Следующий этап после текущего — по порядку, который компания
// выставила в настройках. Нужен кнопке «Рекомендую дальше» в календаре:
// после успешного интервью кандидат двигается сам, без похода в карточку.
// Так он не перепрыгивает через этапы, добавленные вручную.
// Из паузы и отказа дальше не ведём: куда двигать, решает человек.
export function nextProgressStage<T extends { id: string; key: StageKey | null }>(
  stagesInOrder: T[],
  currentId: string,
): T | null {
  const index = stagesInOrder.findIndex((stage) => stage.id === currentId);
  if (index === -1 || !isProgressStep(stagesInOrder[index].key)) return null;

  return (
    stagesInOrder.slice(index + 1).find((stage) => isProgressStep(stage.key)) ??
    null
  );
}

// Куда встаёт новый этап: сразу после последней ступени воронки,
// перед паузами и отказами. В конец списка его ставить неудобно —
// он оказался бы после «Отказ от нас», и его пришлось бы тащить вверх.
export function insertIndexForNewStage(stagesInOrder: { key: StageKey | null }[]): number {
  for (let index = stagesInOrder.length - 1; index >= 0; index--) {
    if (isProgressStep(stagesInOrder[index].key)) return index + 1;
  }
  return stagesInOrder.length;
}

// Перестановка соседей: «выше» или «ниже». Возвращает новый порядок
// идентификаторов или null, если двигать некуда.
export function moveInOrder(
  ids: string[],
  id: string,
  direction: "up" | "down",
): string[] | null {
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return null;

  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
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
