import { describe, expect, it } from "vitest";
import { joinUrl, meetingUrlFromText, normalizeMeetingUrl } from "@/lib/meeting";

describe("Ссылка на встречу", () => {
  it("принимает ссылку Google Meet", () => {
    expect(normalizeMeetingUrl(" https://meet.google.com/abc-defg-hij ")).toBe(
      "https://meet.google.com/abc-defg-hij",
    );
  });

  it("дописывает https://, если его забыли", () => {
    expect(normalizeMeetingUrl("meet.google.com/abc-defg-hij")).toBe(
      "https://meet.google.com/abc-defg-hij",
    );
  });

  it("пустое поле — ссылки нет", () => {
    expect(normalizeMeetingUrl("   ")).toBeNull();
  });

  it("не пропускает опасные и неполные ссылки", () => {
    expect(normalizeMeetingUrl("javascript:alert(1)")).toBe("invalid");
    expect(normalizeMeetingUrl("встреча завтра")).toBe("invalid");
    expect(normalizeMeetingUrl("localhost")).toBe("invalid");
  });

  it("находит ссылку на встречу в старом комментарии", () => {
    expect(
      meetingUrlFromText("Офис на Абая 10\nhttps://meet.google.com/abc-defg-hij."),
    ).toBe("https://meet.google.com/abc-defg-hij");
    expect(meetingUrlFromText("Резюме: https://hh.kz/resume/123")).toBeNull();
  });

  it("поле важнее комментария", () => {
    expect(
      joinUrl({
        meetingUrl: "https://zoom.us/j/1",
        comment: "https://meet.google.com/abc-defg-hij",
      }),
    ).toBe("https://zoom.us/j/1");
  });
});
