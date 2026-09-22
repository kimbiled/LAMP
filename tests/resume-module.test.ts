import { describe, expect, it } from "vitest";
import { findSkills, matchSkills } from "@/lib/resume/skills";
import {
  formatMonths,
  parseQuality,
  periodMonths,
  totalExperienceMonths,
} from "@/lib/resume/score";
import { fixMixedScript } from "@/lib/resume/ocr";
import { parseResume } from "@/lib/resume/parse";

// Разбор резюме идёт правилами и словарями, без нейросетей. Значит,
// на одном и том же тексте он обязан давать один и тот же результат —
// это и проверяем.

describe("Навыки по словарю", () => {
  it("находятся в любом месте текста, а не только в разделе «Навыки»", () => {
    const skills = findSkills(
      "Разрабатывал сервисы на Go, деплоил в Kubernetes, очереди на Kafka.",
    );

    expect(skills).toContain("Go");
    expect(skills).toContain("Kubernetes");
    expect(skills).toContain("Kafka");
  });

  it("разные написания сводятся к одному названию", () => {
    expect(findSkills("Работал с k8s")).toContain("Kubernetes");
    expect(findSkills("Опыт с кубернетес")).toContain("Kubernetes");
    expect(findSkills("Писал на js и ts")).toEqual(
      expect.arrayContaining(["JavaScript", "TypeScript"]),
    );
  });

  it("не находит навык внутри другого слова", () => {
    // «Go» не должно находиться в «Google», а «SQL» — в «MySQL».
    expect(findSkills("Использовал Google Docs")).not.toContain("Go");

    const mysql = findSkills("Работал с MySQL");
    expect(mysql).toContain("MySQL");
    expect(mysql).not.toContain("SQL");
  });

  it("названия с точками и плюсами не ломают поиск", () => {
    expect(findSkills("Пишу на C++ и C#")).toEqual(
      expect.arrayContaining(["C++", "C#"]),
    );
    expect(findSkills("Опыт с Next.js")).toContain("Next.js");
  });

  it("совпадение с требованиями вакансии считается в процентах", () => {
    const result = matchSkills(
      ["Go", "Docker", "PostgreSQL"],
      "Требования: Go, Docker, Kubernetes, Kafka",
    );

    expect(result.required).toEqual(
      expect.arrayContaining(["Go", "Docker", "Kubernetes", "Kafka"]),
    );
    expect(result.matched).toEqual(expect.arrayContaining(["Go", "Docker"]));
    expect(result.percent).toBe(50);
  });

  it("без требований процент не выдумывается", () => {
    expect(matchSkills(["Go"], "Ищем хорошего человека").percent).toBe(0);
  });
});

describe("Стаж по датам", () => {
  const today = new Date("2026-09-22T00:00:00Z");

  it("считается из периода в любом написании", () => {
    expect(periodMonths("Январь 2023 — Март 2025", today)).toBe(26);
    expect(periodMonths("05.2021 — 08.2024", today)).toBe(39);
    expect(periodMonths("2022 — 2024", today)).toBe(24);
  });

  it("«настоящее время» считается до сегодня", () => {
    expect(periodMonths("Сентябрь 2025 — настоящее время", today)).toBe(12);
    expect(periodMonths("Март 2026 — по настоящее время", today)).toBe(6);
  });

  it("кривые даты не портят результат", () => {
    expect(periodMonths("Март 2025 — Январь 2020", today)).toBe(0);
    expect(periodMonths("что-то непонятное", today)).toBe(0);
    expect(periodMonths(null, today)).toBe(0);
  });

  it("параллельные работы не удваивают стаж", () => {
    // Два года подряд, но работы пересекаются — это два года, не четыре.
    const months = totalExperienceMonths(
      [
        { period: "Январь 2022 — Январь 2024" },
        { period: "Январь 2023 — Январь 2024" },
      ],
      today,
    );

    expect(months).toBe(24);
  });

  it("перерыв между работами не засчитывается", () => {
    const months = totalExperienceMonths(
      [
        { period: "Январь 2020 — Январь 2021" },
        { period: "Январь 2023 — Январь 2024" },
      ],
      today,
    );

    expect(months).toBe(24);
  });

  it("месяцы превращаются в человеческую строку", () => {
    expect(formatMonths(0)).toBe("не определён");
    expect(formatMonths(1)).toBe("1 месяц");
    expect(formatMonths(14)).toBe("1 год 2 месяца");
    expect(formatMonths(60)).toBe("5 лет");
  });
});

describe("Полнота разбора", () => {
  it("пустое резюме даёт ноль, заполненное — сто", () => {
    const empty = parseQuality(parseResume(""));
    expect(empty.score).toBe(0);
    expect(empty.missing).toContain("телефон");

    const full = parseResume(`Петров Иван Сергеевич
Мужчина, 30 лет, родился 5 июня 1996
+7 701 123 45 67
ivan@mail.kz
Проживает: Астана

Желаемая должность и зарплата
Frontend-разработчик

Опыт работы — 5 лет
Март 2021 — Компания
настоящее время
Frontend-разработчик
- Разработка интерфейсов

Ключевые навыки
React

Образование
Университет`);

    const quality = parseQuality(full);
    expect(quality.score).toBeGreaterThan(90);
  });
});

describe("Починка распознанного текста", () => {
  it("латиница, прочитанная как кириллица, возвращается на место", () => {
    // Так Tesseract читает слово Backend в смешанном тексте.
    expect(fixMixedScript("ВасКепа-разработчик")).toBe("Backend-разработчик");
  });

  it("обычные русские слова не трогаются", () => {
    const text = "Мастер по ремонту, работал в компании, состав отдела";
    expect(fixMixedScript(text)).toBe(text);
  });

  it("короткие слова не трогаются", () => {
    expect(fixMixedScript("кот сон дом")).toBe("кот сон дом");
  });
});
