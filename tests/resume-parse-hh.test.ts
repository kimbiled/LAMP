import { describe, expect, it } from "vitest";
import { parseResume } from "@/lib/resume/parse";

// Проверка на выгрузке резюме с сайта вакансий.
// Особенности такого файла, на которых разборщик спотыкался:
//   1. период работы перенесён на две строки;
//   2. между названием компании и должностью стоят отрасли
//      и маркированный список видов деятельности;
//   3. обязанности перечислены через тире.
// Данные вымышленные.

const RESUME = `Сериков Арман Болатович
Мужчина, 28 лет

Проживает: Алматы

Опыт работы — 3 года 9 месяцев

Июнь 2023 —
Сентябрь 2026
3 года 4 месяца
Астра, Группа компаний, ТМ
www.astra.kz
СМИ, маркетинг, реклама, BTL, PR, дизайн, продюсирование
• Маркетинговые, рекламные, BTL, дизайнерские, Event-, PR-агентства, организация
выставок
Media Planner
- Расчет медиапланов: бюджеты, сроки, прогнозы охвата
- Разработка медиастратегии под цели клиента

Март 2023 — Май
2023
3 месяца
Комфорт
Продавец-консультант
- Консультирование клиентов по ассортименту
- Выкладка и оформление витрин

Ключевые навыки
Медиапланирование, Переговоры

Знание языков
Казахский — Родной
Русский — C2`;

describe("Разбор резюме с сайта вакансий", () => {
  const parsed = parseResume(RESUME);

  it("склеивает период, перенесённый на две строки", () => {
    expect(parsed.experience.length).toBe(2);
    expect(parsed.experience[0].period).toBe("Июнь 2023 — Сентябрь 2026");
    expect(parsed.experience[1].period).toBe("Март 2023 — Май 2023");
  });

  it("берёт название компании, а не сайт и не отрасль", () => {
    expect(parsed.experience[0].companyName).toBe("Астра, Группа компаний, ТМ");
    expect(parsed.experience[1].companyName).toBe("Комфорт");
  });

  it("берёт должность, а не перечень отраслей", () => {
    expect(parsed.experience[0].position).toBe("Media Planner");
    expect(parsed.experience[1].position).toBe("Продавец-консультант");
  });

  it("собирает описание обязанностей без маркеров списка", () => {
    const first = parsed.experience[0].description ?? "";
    expect(first).toContain("Расчет медиапланов");
    expect(first).toContain("Разработка медиастратегии");
    expect(first.startsWith("-")).toBe(false);

    const second = parsed.experience[1].description ?? "";
    expect(second).toContain("Консультирование клиентов");
  });

  it("не тащит в описание отрасли компании", () => {
    const first = parsed.experience[0].description ?? "";
    expect(first).not.toContain("BTL");
  });

  it("находит остальные поля", () => {
    expect(parsed.fullName).toBe("Сериков Арман Болатович");
    expect(parsed.city).toBe("Алматы");
    expect(parsed.experienceYears).toBe(3);
    expect(parsed.skills).toContain("Медиапланирование");
    expect(parsed.languages.length).toBe(2);
  });
});

// Отдельная проверка: период заканчивается словами, а не годом.
// На этом разборщик спотыкался — граница слова в JavaScript
// не работает с кириллицей.
const RESUME_PRESENT = `Заречный Арсений Петрович

Опыт работы — 3 года 6 месяцев

Апрель 2023 —
настоящее время
3 года 6 месяцев
Optimum Media Group
www.omd.com
СМИ, маркетинг, реклама, BTL, PR, дизайн, продюсирование
• Маркетинговые, рекламные, BTL, дизайнерские, Event-агентства, организация
выставок
Media manager
- Изучение и мониторинг рынка, целевой аудитории и конкурентов
- Медиапланирование и реализация рекламных кампаний`;

describe("Период «настоящее время» на отдельной строке", () => {
  const parsed = parseResume(RESUME_PRESENT);

  it("находит место работы", () => {
    expect(parsed.experience.length).toBe(1);
    expect(parsed.experience[0].period).toBe("Апрель 2023 — настоящее время");
    expect(parsed.experience[0].companyName).toBe("Optimum Media Group");
    expect(parsed.experience[0].position).toBe("Media manager");
  });

  it("подставляет должность из последнего места работы", () => {
    expect(parsed.currentPosition).toBe("Media manager");
  });
});
