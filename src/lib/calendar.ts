import { dateToLocalParts, localToDate } from "@/lib/time";

// Расчёты для календаря интервью.
//
// Всё считается в часовом поясе компании и на сервере: браузер получает
// уже готовые номер дня и минуты от полуночи. Так календарь показывает
// одно и то же время независимо от настроек компьютера.

// Сетка суток: с восьми утра до девяти вечера, шаг полчаса.
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 21;
export const SLOT_MINUTES = 30;

// Рабочее время для автоподбора: будни с десяти до семи.
export const WORK_START_HOUR = 10;
export const WORK_END_HOUR = 19;

export const DEFAULT_DURATION = 60;

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export type CalendarDay = {
  date: string;
  weekday: string;
  dayNumber: string;
  monthLabel: string;
  isToday: boolean;
  isWeekend: boolean;
};

// Дата «2026-09-22» плюс сколько-то суток. Считаем через UTC-полдень:
// перевод часов весной и осенью тогда не сдвигает результат на день.
export function shiftDate(dateText: string, days: number): string {
  const [year, month, day] = dateText.split("-").map(Number);
  const moment = new Date(Date.UTC(year, month - 1, day, 12));
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

// Номер дня недели в поясе компании: 0 — понедельник, 6 — воскресенье.
export function weekdayIndex(dateText: string): number {
  const [year, month, day] = dateText.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return (weekday + 6) % 7;
}

// Понедельник той недели, в которую попадает дата.
export function mondayOf(dateText: string): string {
  return shiftDate(dateText, -weekdayIndex(dateText));
}

export function weekDays(monday: string, today: string): CalendarDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(monday, index);
    const [, month, day] = date.split("-");

    return {
      date,
      weekday: WEEKDAYS[index],
      dayNumber: String(Number(day)),
      monthLabel: new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(
        new Date(Date.UTC(2000, Number(month) - 1, 1)),
      ),
      isToday: date === today,
      isWeekend: index >= 5,
    };
  });
}

// Границы недели для запроса к базе: от полуночи понедельника
// до полуночи следующего понедельника по времени компании.
export function weekRange(monday: string): { from: Date; to: Date } {
  const from = localToDate(monday, "00:00");
  const to = localToDate(shiftDate(monday, 7), "00:00");

  if (!from || !to) {
    throw new Error(`Не удалось посчитать границы недели для ${monday}`);
  }

  return { from, to };
}

// Где событие стоит в сетке: дата и минуты от полуночи.
export function placeInDay(value: Date): { date: string; minutes: number } {
  const { date, time } = dateToLocalParts(value);
  const [hours, minutes] = time.split(":").map(Number);
  return { date, minutes: hours * 60 + minutes };
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

// Подписи слева от сетки: 8:00, 9:00 и так далее.
export function hourLabels(): { hour: number; label: string }[] {
  return Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, index) => {
    const hour = DAY_START_HOUR + index;
    return { hour, label: `${hour}:00` };
  });
}

export function weekTitle(monday: string): string {
  const sunday = shiftDate(monday, 6);
  const format = (dateText: string, withYear: boolean) => {
    const [year, month, day] = dateText.split("-").map(Number);
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      ...(withYear ? { year: "numeric" } : {}),
    }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  };

  return `${format(monday, false)} — ${format(sunday, true)}`;
}
