import { describe, expect, it } from "vitest";
import { daysToOffer, median, percent } from "@/lib/analytics";

describe("Расчёты аналитики", () => {
  it("медиана не тянется за одним долгим случаем", () => {
    expect(median([5, 7, 180])).toBe(7);
    expect(median([4, 6])).toBe(5);
    expect(median([])).toBeNull();
  });

  it("процент без деления на ноль", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
  });

  it("срок до оффера — только у дошедших", () => {
    const created = new Date("2026-10-01T09:00:00Z");
    const offers = new Map([["a", new Date("2026-10-15T12:00:00Z")]]);
    expect(
      daysToOffer(
        [
          { id: "a", createdAt: created },
          { id: "b", createdAt: created },
        ],
        offers,
      ),
    ).toEqual([14]);
  });
});
