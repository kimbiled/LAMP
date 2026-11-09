import { describe, expect, it } from "vitest";
import {
  cardCompleteness,
  durationText,
  teamRecommendations,
  type ManagerStats,
  type RecruiterStats,
} from "@/lib/team-analytics";

const recruiter = (patch: Partial<RecruiterStats> = {}): RecruiterStats => ({
  id: "r1",
  name: "Роман",
  added: 10,
  jobsClosed: 1,
  daysToClose: 20,
  daysToOffer: 10,
  hoursToFirstMove: 5,
  untouched: 0,
  completeness: 90,
  ...patch,
});

const manager = (patch: Partial<ManagerStats> = {}): ManagerStats => ({
  id: "m1",
  name: "Максим",
  jobs: 1,
  interviews: 3,
  feedbacks: 3,
  hoursToFeedback: 4,
  awaiting: 0,
  ...patch,
});

describe("аналитика команды", () => {
  it("заполненность карточки", () => {
    expect(
      cardCompleteness({
        phone: "+7",
        email: null,
        currentPosition: "Бухгалтер",
        city: "Астана",
        experienceYears: 3,
        experienceMonths: null,
        skills: ["1С"],
        sourceChannel: "COLD",
      }),
    ).toBe(100);
    expect(
      cardCompleteness({
        phone: null,
        email: null,
        currentPosition: null,
        city: null,
        experienceYears: null,
        experienceMonths: null,
        skills: [],
        sourceChannel: null,
      }),
    ).toBe(0);
  });

  it("подпись срока", () => {
    expect(durationText(null)).toBe("—");
    expect(durationText(5)).toBe("5 ч");
    expect(durationText(72)).toBe("3 дн");
  });

  it("хорошая команда — одна спокойная рекомендация", () => {
    const tips = teamRecommendations([recruiter()], [manager()]);
    expect(tips).toHaveLength(1);
    expect(tips[0]).toContain("хороший темп");
  });

  it("медленный первый ответ и пустые карточки — советы рекрутеру", () => {
    const tips = teamRecommendations(
      [recruiter({ hoursToFirstMove: 96, completeness: 40, untouched: 7 })],
      [],
    );
    expect(tips.some((tip) => tip.includes("ждут первого движения 4 дн"))).toBe(true);
    expect(tips.some((tip) => tip.includes("заполнены на 40%"))).toBe(true);
    expect(tips.some((tip) => tip.includes("7 кандидатов"))).toBe(true);
  });

  it("медленный отзыв менеджера", () => {
    const tips = teamRecommendations([], [manager({ hoursToFeedback: 72, awaiting: 4 })]);
    expect(tips.some((tip) => tip.includes("через 3 дн"))).toBe(true);
    expect(tips.some((tip) => tip.includes("4 прошедших встреч"))).toBe(true);
  });

  it("сравнивает самого быстрого и самого медленного", () => {
    const tips = teamRecommendations(
      [
        recruiter({ id: "a", name: "Айгерим", hoursToFirstMove: 4 }),
        recruiter({ id: "b", name: "Бекзат", hoursToFirstMove: 40 }),
      ],
      [],
    );
    expect(tips.some((tip) => tip.startsWith("Айгерим разбирает"))).toBe(true);
  });
});
