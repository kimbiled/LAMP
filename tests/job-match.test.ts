import { describe, expect, it } from "vitest";
import { jobKeywords, rankMatches } from "@/lib/job-match";

describe("подбор из базы по описанию вакансии", () => {
  it("берёт значимые слова и выбрасывает служебные", () => {
    const words = jobKeywords(
      "Аналитик данных. Требования: опыт от 3 лет, SQL, Power BI, Excel",
    );
    expect(words).toEqual(
      expect.arrayContaining(["аналит", "данны", "sql", "power", "bi", "excel"]),
    );
    expect(words).not.toContain("опыт");
    expect(words).not.toContain("требования");
    expect(words).not.toContain("3");
  });

  it("обрезает русские окончания, чтобы находить все формы", () => {
    expect(jobKeywords("бухгалтерия")).toEqual(["бухгалтер"]);
    expect("аналитиком").toContain(jobKeywords("аналитика")[0]);
  });

  it("не больше заданного числа слов, без повторов", () => {
    expect(jobKeywords("sql sql sql python", 10)).toEqual(["sql", "python"]);
    expect(jobKeywords("a1 b2 c3 d4 e5 f6", 3)).toHaveLength(3);
  });

  it("выше тот, у кого совпало больше слов", () => {
    const ranked = rankMatches([["raim", "anna"], ["raim"], ["raim", "oleg"]]);
    expect(ranked[0]).toEqual({ id: "raim", score: 3 });
    expect(ranked).toHaveLength(3);
  });
});
