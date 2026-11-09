// Персонаж-помощник: папка с резюме, которую можно наряжать.
//
// Новые вещи открываются за закрытые вакансии в текущем месяце —
// где человек назначен рекрутером или нанимающим менеджером.
// Каждый месяц счёт начинается заново, но уже надетое остаётся.

export type MascotPart = "color" | "hat" | "glasses" | "item" | "shoes";

export type MascotOption = {
  id: string;
  label: string;
  // Сколько вакансий нужно закрыть в этом месяце, чтобы открыть.
  need: number;
};

export const MASCOT_PARTS: { part: MascotPart; title: string; options: MascotOption[] }[] = [
  {
    part: "color",
    title: "Цвет папки",
    options: [
      { id: "khaki", label: "Хаки", need: 0 },
      { id: "sky", label: "Небесный", need: 0 },
      { id: "terracotta", label: "Терракота", need: 1 },
      { id: "lavender", label: "Лаванда", need: 2 },
      { id: "graphite", label: "Графит", need: 3 },
      { id: "gold", label: "Золото", need: 5 },
    ],
  },
  {
    part: "hat",
    title: "Головной убор",
    options: [
      { id: "none", label: "Без шапки", need: 0 },
      { id: "cap", label: "Кепка", need: 1 },
      { id: "beret", label: "Берет", need: 2 },
      { id: "party", label: "Праздничный колпак", need: 3 },
      { id: "crown", label: "Корона", need: 5 },
    ],
  },
  {
    part: "glasses",
    title: "Очки",
    options: [
      { id: "none", label: "Без очков", need: 0 },
      { id: "round", label: "Круглые", need: 1 },
      { id: "sun", label: "Солнечные", need: 3 },
    ],
  },
  {
    part: "item",
    title: "В руке",
    options: [
      { id: "calendar", label: "Календарь", need: 0 },
      { id: "coffee", label: "Кофе", need: 1 },
      { id: "magnifier", label: "Лупа", need: 2 },
      { id: "flower", label: "Цветок", need: 3 },
      { id: "trophy", label: "Кубок", need: 4 },
    ],
  },
  {
    part: "shoes",
    title: "Обувь",
    options: [
      { id: "black", label: "Туфли", need: 0 },
      { id: "red", label: "Красные кеды", need: 1 },
      { id: "white", label: "Белые кроссовки", need: 2 },
      { id: "gold", label: "Золотые", need: 5 },
    ],
  },
];

export type MascotLook = Record<MascotPart, string>;

export const DEFAULT_LOOK: MascotLook = {
  color: "khaki",
  hat: "none",
  glasses: "none",
  item: "calendar",
  shoes: "black",
};

// Из базы приходит что угодно (JSON) — берём только известные значения.
export function readLook(value: unknown): MascotLook {
  const look: MascotLook = { ...DEFAULT_LOOK };
  if (!value || typeof value !== "object") return look;
  for (const { part, options } of MASCOT_PARTS) {
    const raw = (value as Record<string, unknown>)[part];
    if (typeof raw === "string" && options.some((option) => option.id === raw)) {
      look[part] = raw;
    }
  }
  return look;
}

export function optionNeed(part: MascotPart, id: string): number {
  const options = MASCOT_PARTS.find((item) => item.part === part)?.options ?? [];
  return options.find((option) => option.id === id)?.need ?? Infinity;
}

// Можно ли надеть такой образ: каждая вещь либо уже открыта в этом
// месяце, либо была надета раньше (заработанное не отбирается).
export function lookAllowed(next: MascotLook, current: MascotLook, closed: number): boolean {
  return MASCOT_PARTS.every(({ part }) => {
    if (next[part] === current[part]) return true;
    return optionNeed(part, next[part]) <= closed;
  });
}

// Сколько осталось до следующей вещи.
export function nextUnlock(closed: number): { need: number; label: string } | null {
  const upcoming = MASCOT_PARTS.flatMap(({ options }) => options)
    .filter((option) => option.need > closed)
    .sort((a, b) => a.need - b.need)[0];
  return upcoming ? { need: upcoming.need - closed, label: upcoming.label } : null;
}
