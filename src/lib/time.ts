// Работа с датой и временем в часовом поясе компании.
//
// Зачем это нужно: когда Skillo будет работать в интернете, сервер, скорее
// всего, будет жить по UTC. Без пересчёта интервью, назначенное на 15:00,
// показывалось бы как 20:00. Поэтому введённые дата и время всегда
// переводятся из вашего пояса в универсальное время и обратно.

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Almaty";

function offsetMinutes(timeZone: string, at: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(at)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return (asUtc - at.getTime()) / 60000;
}

// «2026-09-22» + «15:00» в поясе компании → момент времени для базы.
export function localToDate(
  dateText: string,
  timeText: string,
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  if (!/^\d{2}:\d{2}$/.test(timeText)) return null;

  const naive = new Date(`${dateText}T${timeText}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;

  const offset = offsetMinutes(APP_TIMEZONE, naive);
  return new Date(naive.getTime() - offset * 60000);
}

// Обратное преобразование — чтобы подставить значения в поля формы.
export function dateToLocalParts(value: Date): { date: string; time: string } {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Формат sv-SE даёт «2026-09-22 15:00» — удобно разрезать пополам.
  const [date, time] = formatter.format(value).split(" ");
  return { date, time };
}

// Сегодняшняя дата в поясе компании, для значения по умолчанию в форме.
export function todayLocal(): string {
  return dateToLocalParts(new Date()).date;
}

// Сколько дней прошло между двумя датами вида «2026-09-30».
//
// Считает по датам, а не по часам: человек, переведённый вчера вечером,
// сегодня утром сидит на этапе «1 день», а не «0». Функция чистая —
// текущее время сюда передают снаружи, поэтому её видно в проверках.
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) return 0;

  return Math.max(Math.round((end - start) / 86_400_000), 0);
}

// Момент «N дней назад» — для фильтров «за 7 / 30 / 90 дней».
// Отдельной функцией, а не Date.now() прямо в странице: так страница
// остаётся «чистой» для проверок React, а время берётся в одном месте.
export function daysAgo(days: number): Date | null {
  return days > 0 ? new Date(Date.now() - days * 86_400_000) : null;
}

// Текущий момент — для страниц, которым нужно «сейчас» (аналитика
// команды). Отдельной функцией по той же причине, что и daysAgo.
export function currentTime(): Date {
  return new Date();
}
