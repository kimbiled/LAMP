import { describe, expect, it } from "vitest";
import { parseResume } from "@/lib/resume/parse";

// Проверяем распознавание резюме на типовом тексте.
// Если однажды правила разбора сломаются, эти проверки это поймают.

const RESUME = `Петров Иван Сергеевич
Мужчина, 32 года, родился 12 марта 1994

+7 (701) 123-45-67 — предпочитаемый способ связи
ivan.petrov@mail.kz
Telegram: @ivan_petrov

Проживает: Астана
Гражданство: Казахстан

Желаемая должность: Frontend-разработчик
Желаемая зарплата: 900 000 ₸

Опыт работы — 7 лет 3 месяца

Март 2021 — настоящее время
4 года 6 месяцев
ТОО «Кселл Диджитал»
Астана, kcell.kz
Frontend-разработчик
Разработка личного кабинета абонента на React.

Июнь 2018 — Февраль 2021
2 года 9 месяцев
ТОО «Чокопай Софт»
Алматы
Верстальщик
Вёрстка лендингов.

Ключевые навыки
React, TypeScript, JavaScript, HTML, CSS

Знание языков
Русский — Родной
Английский — B1

Образование
2016 Евразийский национальный университет
Информационные системы`;

describe("Разбор резюме", () => {
  const parsed = parseResume(RESUME);

  it("находит ФИО", () => {
    expect(parsed.fullName).toBe("Петров Иван Сергеевич");
  });

  it("приводит телефон к единому виду", () => {
    expect(parsed.phone).toBe("+7 701 123 45 67");
  });

  it("находит почту и Telegram", () => {
    expect(parsed.email).toBe("ivan.petrov@mail.kz");
    expect(parsed.telegram).toBe("ivan_petrov");
  });

  it("находит город и должность", () => {
    expect(parsed.city).toBe("Астана");
    expect(parsed.currentPosition).toBe("Frontend-разработчик");
  });

  it("находит опыт и зарплатные ожидания в тенге", () => {
    expect(parsed.experienceYears).toBe(7);
    expect(parsed.salaryExpectation).toBe(900000);
    expect(parsed.currency).toBe("KZT");
  });

  it("разбирает навыки и языки", () => {
    expect(parsed.skills).toContain("React");
    expect(parsed.skills).toContain("TypeScript");
    expect(parsed.languages.length).toBe(2);
  });

  it("разбирает места работы без города и сайта в должности", () => {
    expect(parsed.experience.length).toBe(2);
    expect(parsed.experience[0].companyName).toBe("ТОО «Кселл Диджитал»");
    expect(parsed.experience[0].position).toBe("Frontend-разработчик");
    expect(parsed.experience[1].companyName).toBe("ТОО «Чокопай Софт»");
    expect(parsed.experience[1].position).toBe("Верстальщик");
  });

  it("разбирает образование", () => {
    expect(parsed.education.length).toBe(1);
    expect(parsed.education[0].years).toBe("2016");
  });

  it("не падает на пустом тексте", () => {
    const empty = parseResume("");
    expect(empty.fullName).toBeNull();
    expect(empty.skills).toEqual([]);
  });
});

describe("Telegram не выдумывается из похожих слов", () => {
  // «PostgreSQL» содержит «tg», и раньше метка Telegram находилась
  // прямо внутри слова: у каждого айтишника появлялся ник @reSQL.
  it("не принимает PostgreSQL за метку Telegram", () => {
    const parsed = parseResume(
      "Иван Петров\nНавыки: Python, PostgreSQL, Docker, Git",
    );
    expect(parsed.telegram).toBeNull();
  });

  it("находит настоящий ник рядом с PostgreSQL", () => {
    const parsed = parseResume(
      "Иван Петров\nНавыки: PostgreSQL, Docker\nTelegram: @ivan_petrov",
    );
    expect(parsed.telegram).toBe("ivan_petrov");
  });

  it("понимает короткую метку tg", () => {
    expect(parseResume("Связь\ntg @nurlan_ab").telegram).toBe("nurlan_ab");
  });
});
