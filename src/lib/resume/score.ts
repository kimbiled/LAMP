import type { ParsedResume } from "./parse";

// Показатели по резюме. Считаются правилами, без всякой нейросети:
// одно и то же резюме всегда даёт один и тот же результат, и любую
// цифру можно объяснить человеку.

const MONTHS = [
  "январ",
  "феврал",
  "март",
  "апрел",
  "ма",
  "июн",
  "июл",
  "август",
  "сентябр",
  "октябр",
  "ноябр",
  "декабр",
];

const MONTHS_EN = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const NOW_WORDS =/наст(оящее)?\s*время|по\s*наст|сейчас|present|current/i;

type Point = { year: number; month: number };

// «Март 2021», «03.2021», «2021» — начало или конец периода работы.
function readPoint(value: string): Point | null {
  const cleaned = value.trim().toLowerCase();

  const withMonth = cleaned.match(/([а-яёa-z]+)\.?\s+(\d{4})/);
  if (withMonth) {
    const word = withMonth[1];
    // Полное название («марта») или сокращение («мар», «сен»):
    // новая выгрузка hh и дизайнерские резюме пишут сокращённо.
    let index = MONTHS.findIndex(
      (name) =>
        word.startsWith(name) || (word.length >= 3 && name.startsWith(word)),
    );
    if (index < 0) {
      index = MONTHS_EN.findIndex((name) => word.startsWith(name));
    }
    if (index >= 0) {
      return { year: Number(withMonth[2]), month: index };
    }
  }

  const numeric = cleaned.match(/(\d{1,2})[./](\d{4})/);
  if (numeric) {
    const month = Number(numeric[1]);
    if (month >= 1 && month <= 12) {
      return { year: Number(numeric[2]), month: month - 1 };
    }
  }

  const yearOnly = cleaned.match(/(?:^|\D)(\d{4})(?:\D|$)/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (year >= 1950 && year <= 2100) {
      return { year, month: 0 };
    }
  }

  return null;
}

const monthsBetween = (from: Point, to: Point) =>
  (to.year - from.year) * 12 + (to.month - from.month);

// Сколько месяцев длился один период работы.
// «Июнь 2023 — настоящее время» считается до сегодняшнего дня.
export function periodMonths(
  period: string | null,
  today = new Date(),
): number {
  if (!period) return 0;

  const parts = period.split(/[—–-]/);
  if (parts.length < 2) return 0;

  const from = readPoint(parts[0]);
  if (!from) return 0;

  const tail = parts.slice(1).join("-");
  const to = NOW_WORDS.test(tail)
    ? { year: today.getFullYear(), month: today.getMonth() }
    : readPoint(tail);

  if (!to) return 0;

  const months = monthsBetween(from, to);

  // Отрицательная длительность означает, что даты распознались криво.
  // Лучше не учитывать такое место работы, чем портить общий стаж.
  return months > 0 && months < 12 * 60 ? months : 0;
}

// Общий стаж по датам мест работы.
//
// Периоды складываются объединением, а не суммой: если человек год
// работал на двух работах сразу, это год стажа, а не два.
export function totalExperienceMonths(
  experience: { period: string | null }[],
  today = new Date(),
): number {
  const ranges: { start: number; end: number }[] = [];

  for (const item of experience) {
    if (!item.period) continue;

    const parts = item.period.split(/[—–-]/);
    if (parts.length < 2) continue;

    const from = readPoint(parts[0]);
    if (!from) continue;

    const tail = parts.slice(1).join("-");
    const to = NOW_WORDS.test(tail)
      ? { year: today.getFullYear(), month: today.getMonth() }
      : readPoint(tail);

    if (!to) continue;

    const start = from.year * 12 + from.month;
    const end = to.year * 12 + to.month;

    if (end > start && end - start < 12 * 60) {
      ranges.push({ start, end });
    }
  }

  if (ranges.length === 0) return 0;

  ranges.sort((a, b) => a.start - b.start);

  let total = 0;
  let current = ranges[0];

  for (const range of ranges.slice(1)) {
    if (range.start <= current.end) {
      current = { start: current.start, end: Math.max(current.end, range.end) };
    } else {
      total += current.end - current.start;
      current = range;
    }
  }

  return total + (current.end - current.start);
}

// Поля, по которым судим о полноте распознавания. Вес — насколько
// поле важно рекрутеру: без телефона с человеком не связаться,
// а без города можно прожить.
const WEIGHTS: {
  label: string;
  weight: number;
  has: (r: ParsedResume) => boolean;
}[] = [
  { label: "ФИО", weight: 3, has: (r) => Boolean(r.fullName) },
  { label: "телефон", weight: 3, has: (r) => Boolean(r.phone) },
  { label: "почта", weight: 2, has: (r) => Boolean(r.email) },
  { label: "должность", weight: 2, has: (r) => Boolean(r.currentPosition) },
  { label: "опыт работы", weight: 3, has: (r) => r.experience.length > 0 },
  { label: "образование", weight: 1, has: (r) => r.education.length > 0 },
  { label: "город", weight: 1, has: (r) => Boolean(r.city) },
  { label: "навыки", weight: 1, has: (r) => r.skills.length > 0 },
  { label: "дата рождения", weight: 1, has: (r) => Boolean(r.birthDate) },
];

export type ParseQuality = {
  // 0-100: насколько полно удалось разобрать файл.
  score: number;
  // Чего не хватает — это показываем рекрутеру, чтобы он дозаполнил.
  missing: string[];
};

export function parseQuality(parsed: ParsedResume): ParseQuality {
  const total = WEIGHTS.reduce((sum, field) => sum + field.weight, 0);

  const gained = WEIGHTS.filter((field) => field.has(parsed)).reduce(
    (sum, field) => sum + field.weight,
    0,
  );

  return {
    score: Math.round((gained / total) * 100),
    missing: WEIGHTS.filter((field) => !field.has(parsed)).map(
      (field) => field.label,
    ),
  };
}

// «3 года 4 месяца» — для показа в карточке.
export function formatMonths(months: number): string {
  if (months <= 0) return "не определён";

  const years = Math.floor(months / 12);
  const rest = months % 12;

  const yearWord = (n: number) =>
    n % 10 === 1 && n % 100 !== 11
      ? "год"
      : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
        ? "года"
        : "лет";

  const monthWord = (n: number) =>
    n % 10 === 1 && n % 100 !== 11
      ? "месяц"
      : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
        ? "месяца"
        : "месяцев";

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${yearWord(years)}`);
  if (rest > 0) parts.push(`${rest} ${monthWord(rest)}`);

  return parts.join(" ");
}
