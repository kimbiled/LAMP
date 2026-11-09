import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, lookAllowed, nextUnlock, readLook } from "@/lib/mascot";

describe("персонаж", () => {
  it("из базы берёт только известные вещи", () => {
    expect(readLook(null)).toEqual(DEFAULT_LOOK);
    expect(readLook({ hat: "crown", color: "rainbow", item: 5 })).toEqual({
      ...DEFAULT_LOOK,
      hat: "crown",
    });
  });

  it("закрытую вещь надеть нельзя, открытую — можно", () => {
    const crown = { ...DEFAULT_LOOK, hat: "crown" };
    expect(lookAllowed(crown, DEFAULT_LOOK, 0)).toBe(false);
    expect(lookAllowed(crown, DEFAULT_LOOK, 5)).toBe(true);
  });

  it("заработанное не отбирается в новом месяце", () => {
    const crown = { ...DEFAULT_LOOK, hat: "crown" };
    // Корона уже надета, в новом месяце закрытых вакансий ещё нет.
    expect(lookAllowed({ ...crown, color: "sky" }, crown, 0)).toBe(true);
  });

  it("подсказывает, сколько осталось до следующей вещи", () => {
    expect(nextUnlock(0)).toEqual({ need: 1, label: expect.any(String) });
    expect(nextUnlock(4)?.need).toBe(1);
    expect(nextUnlock(5)).toBeNull();
  });
});
