import { describe, expect, it } from "vitest";
import {
  mondayOf,
  shiftDate,
  minutesToTime,
  weekDays,
  weekdayIndex,
  weekTitle,
} from "@/lib/calendar";

// Календарь считает дни арифметикой по датам, а не по миллисекундам.
// Ошибка на один день здесь означает интервью не в тот день, поэтому
// проверяем переходы через месяц, год и февраль високосного года.

describe("Дни календаря", () => {
  it("сдвиг даты не ломается на границах месяца и года", () => {
    expect(shiftDate("2026-09-21", 1)).toBe("2026-09-22");
    expect(shiftDate("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate("2026-09-21", 7)).toBe("2026-09-28");
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("понедельник считается верно для любого дня недели", () => {
    // 21 сентября 2026 года — понедельник.
    expect(weekdayIndex("2026-09-21")).toBe(0);
    expect(weekdayIndex("2026-09-27")).toBe(6);

    expect(mondayOf("2026-09-21")).toBe("2026-09-21");
    expect(mondayOf("2026-09-24")).toBe("2026-09-21");
    expect(mondayOf("2026-09-27")).toBe("2026-09-21");
    expect(mondayOf("2026-09-28")).toBe("2026-09-28");
  });

  it("неделя — это ровно семь дней с понедельника по воскресенье", () => {
    const days = weekDays("2026-09-21", "2026-09-23");

    expect(days).toHaveLength(7);
    expect(days[0].weekday).toBe("Пн");
    expect(days[6].weekday).toBe("Вс");
    expect(days[6].date).toBe("2026-09-27");

    // Выходными считаются суббота и воскресенье, сегодня — среда.
    expect(
      days.filter((day) => day.isWeekend).map((day) => day.weekday),
    ).toEqual(["Сб", "Вс"]);
    expect(days.filter((day) => day.isToday)).toHaveLength(1);
    expect(days.find((day) => day.isToday)?.date).toBe("2026-09-23");
  });

  it("заголовок недели показывает обе границы", () => {
    expect(weekTitle("2026-09-21")).toContain("21 сентября");
    expect(weekTitle("2026-09-21")).toContain("27 сентября");
  });

  it("минуты превращаются во время с ведущим нулём", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(9 * 60 + 5)).toBe("09:05");
    expect(minutesToTime(15 * 60 + 30)).toBe("15:30");
  });
});
