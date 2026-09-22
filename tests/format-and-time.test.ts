import { describe, expect, it } from "vitest";
import {
  ageFrom,
  formatBirth,
  CANDIDATE_FORMS,
  formatBytes,
  formatMoney,
  formatSalary,
  plural,
} from "@/lib/format";
import { dateToLocalParts, localToDate } from "@/lib/time";
import { isWeakPassword, candidateSchema, loginSchema } from "@/lib/validation";

describe("Числа и деньги", () => {
  it("склоняет слова после чисел", () => {
    expect(plural(1, CANDIDATE_FORMS)).toBe("кандидат");
    expect(plural(2, CANDIDATE_FORMS)).toBe("кандидата");
    expect(plural(5, CANDIDATE_FORMS)).toBe("кандидатов");
    expect(plural(11, CANDIDATE_FORMS)).toBe("кандидатов");
    expect(plural(21, CANDIDATE_FORMS)).toBe("кандидат");
    expect(plural(0, CANDIDATE_FORMS)).toBe("кандидатов");
  });

  it("показывает суммы с символом валюты", () => {
    expect(formatMoney(900000, "KZT")).toContain("₸");
    expect(formatMoney(900000, "USD")).toContain("$");
  });

  it("показывает зарплатную вилку", () => {
    expect(formatSalary(null, null, "KZT")).toBe("Не указана");
    expect(formatSalary(500000, null, "KZT")).toContain("от");
    expect(formatSalary(null, 800000, "KZT")).toContain("до");
    expect(formatSalary(500000, 800000, "KZT")).toContain("–");
  });

  it("показывает размер файла", () => {
    expect(formatBytes(500)).toBe("500 Б");
    expect(formatBytes(2048)).toBe("2 КБ");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 МБ");
  });
});

describe("Часовой пояс", () => {
  it("сохраняет введённое время и возвращает его обратно", () => {
    const moment = localToDate("2026-09-22", "15:00");
    expect(moment).not.toBeNull();

    const parts = dateToLocalParts(moment as Date);
    expect(parts.date).toBe("2026-09-22");
    expect(parts.time).toBe("15:00");
  });

  it("переводит местное время в всемирное", () => {
    // Астана — UTC+5, значит 15:00 у нас это 10:00 по UTC.
    const moment = localToDate("2026-09-22", "15:00") as Date;
    expect(moment.toISOString()).toBe("2026-09-22T10:00:00.000Z");
  });

  it("отклоняет неверный ввод", () => {
    expect(localToDate("не дата", "15:00")).toBeNull();
    expect(localToDate("2026-09-22", "25")).toBeNull();
  });
});

describe("Проверка форм", () => {
  it("не пропускает простые пароли", () => {
    expect(isWeakPassword("password")).toBe(true);
    expect(isWeakPassword("12345678")).toBe(true);
    expect(isWeakPassword("Astana-2026-Lamp")).toBe(false);
  });

  it("требует пароль при входе", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.kz", password: "" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: "не почта", password: "12345678" })
        .success,
    ).toBe(false);
  });

  it("требует ФИО у кандидата, остальное не обязательно", () => {
    const base = {
      fullName: "Петров Иван",
      jobId: null,
      stageId: "stage-1",
      phone: "",
      email: "",
      city: "",
      birthDate: "",
      currentPosition: "",
      experienceYears: null,
      salaryExpectation: null,
      currency: "KZT",
      telegram: "",
      skills: [],
      languages: [],
      source: "",
      note: "",
    };

    expect(candidateSchema.safeParse(base).success).toBe(true);
    expect(candidateSchema.safeParse({ ...base, fullName: "П" }).success).toBe(
      false,
    );
    expect(
      candidateSchema.safeParse({ ...base, email: "кривая почта" }).success,
    ).toBe(false);
    expect(
      candidateSchema.safeParse({ ...base, experienceYears: -1 }).success,
    ).toBe(false);
  });
});

describe("Дата рождения и возраст", () => {
  it("считает полный возраст", () => {
    const born = new Date();
    born.setFullYear(born.getFullYear() - 30);
    expect(ageFrom(born)).toBe(30);

    // День рождения ещё не наступил в этом году — возраст на год меньше.
    const soon = new Date();
    soon.setFullYear(soon.getFullYear() - 30);
    soon.setDate(soon.getDate() + 1);
    expect(ageFrom(soon)).toBe(29);

    expect(ageFrom(null)).toBeNull();
  });

  it("показывает дату и возраст одной строкой", () => {
    const text = formatBirth(new Date("1994-03-12T00:00:00Z")) ?? "";
    expect(text).toContain("1994");
    expect(text).toContain("марта");
    expect(text).toContain("·");
    expect(text.endsWith("г.")).toBe(false);
    expect(formatBirth(null)).toBeNull();
  });
});
