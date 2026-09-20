import "server-only";
import { db } from "@/lib/db";
import { localToDate, dateToLocalParts } from "@/lib/time";
import {
  DEFAULT_DURATION,
  SLOT_MINUTES,
  WORK_END_HOUR,
  WORK_START_HOUR,
  minutesToTime,
  placeInDay,
  shiftDate,
  weekdayIndex,
} from "@/lib/calendar";

// Автоподбор времени интервью.
//
// Ищем ближайшие свободные окна в рабочие часы: будни с десяти до семи.
// Занятыми считаем время, где уже стоит интервью у того же интервьюера
// или у того же кандидата — двух встреч одновременно не бывает.
//
// Никаких внешних календарей: смотрим только на то, что назначено в LAMP.

export type Suggestion = {
  date: string;
  time: string;
  label: string;
};

type Busy = { start: number; end: number };

const LOOKAHEAD_DAYS = 21;

function overlaps(start: number, end: number, busy: Busy[]): boolean {
  return busy.some((item) => start < item.end && end > item.start);
}

export async function suggestSlots(params: {
  companyId: string;
  interviewerId?: string | null;
  candidateId?: string | null;
  durationMinutes?: number | null;
  count?: number;
}): Promise<Suggestion[]> {
  const duration = params.durationMinutes || DEFAULT_DURATION;
  const wanted = params.count ?? 6;

  const from = new Date();
  const until = localToDate(
    shiftDate(dateToLocalParts(from).date, LOOKAHEAD_DAYS),
    "00:00",
  );

  // Чужие интервью нас не интересуют: только те, что мешают этим двоим.
  const people = [params.interviewerId, params.candidateId].filter(Boolean);

  const existing =
    people.length === 0
      ? []
      : await db.interview.findMany({
          where: {
            companyId: params.companyId,
            status: "SCHEDULED",
            scheduledAt: { gte: from, ...(until ? { lt: until } : {}) },
            OR: [
              ...(params.interviewerId
                ? [{ interviewerId: params.interviewerId }]
                : []),
              ...(params.candidateId
                ? [{ candidateId: params.candidateId }]
                : []),
            ],
          },
          select: { scheduledAt: true, durationMinutes: true },
        });

  // Занятое время раскладываем по дням в минутах от полуночи.
  const busyByDay = new Map<string, Busy[]>();
  for (const interview of existing) {
    const { date, minutes } = placeInDay(interview.scheduledAt);
    const list = busyByDay.get(date) ?? [];
    list.push({
      start: minutes,
      end: minutes + (interview.durationMinutes || DEFAULT_DURATION),
    });
    busyByDay.set(date, list);
  }

  // Начинаем с ближайшего получаса после текущего момента,
  // чтобы не предложить время, которое уже прошло.
  const nowParts = placeInDay(from);
  const earliest =
    Math.ceil((nowParts.minutes + 5) / SLOT_MINUTES) * SLOT_MINUTES;

  const suggestions: Suggestion[] = [];

  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
    if (suggestions.length >= wanted) break;

    const date = shiftDate(nowParts.date, offset);
    if (weekdayIndex(date) >= 5) continue; // суббота и воскресенье

    const dayStart =
      offset === 0
        ? Math.max(WORK_START_HOUR * 60, earliest)
        : WORK_START_HOUR * 60;
    const busy = busyByDay.get(date) ?? [];

    for (
      let start = dayStart;
      start + duration <= WORK_END_HOUR * 60;
      start += SLOT_MINUTES
    ) {
      if (suggestions.length >= wanted) break;
      if (overlaps(start, start + duration, busy)) continue;

      const time = minutesToTime(start);
      suggestions.push({
        date,
        time,
        label: `${dayLabel(date)}, ${time}`,
      });

      // Не больше двух вариантов в один день: полезнее показать
      // несколько разных дней, чем всё утро понедельника.
      if (suggestions.filter((item) => item.date === date).length >= 2) break;
    }
  }

  return suggestions;
}

function dayLabel(dateText: string): string {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
