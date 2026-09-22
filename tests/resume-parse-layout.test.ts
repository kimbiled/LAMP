import { describe, expect, it } from "vitest";
import { parseResume } from "@/lib/resume/parse";

// Случаи, на которых разбор спотыкался на настоящих файлах.
// Все данные вымышленные, но верстка повторяет реальную.

describe("Период и компания в одной строке", () => {
  // PDF с сайта вакансий верстает даты и компанию двумя колонками
  // на одной высоте. При чтении по координатам они склеиваются
  // в одну строку, а окончание периода уезжает на следующую.
  const RESUME = `Ахметова Дана
Проживает: Караганда

Опыт работы — 4 года

Январь 2025 — Астра Медиа
настоящее время
СМИ, маркетинг, реклама, BTL, PR, дизайн, продюсирование
1 год 9 месяцев
• Маркетинговые, рекламные, BTL, дизайнерские, Event-, PR-агентства, организация
выставок
Digital Group Head
- Управление командой медиапланирования
- Мониторинг выполнения KPI и бюджетов`;

  const parsed = parseResume(RESUME);

  it("период собирается целиком", () => {
    expect(parsed.experience).toHaveLength(1);
    expect(parsed.experience[0].period).toBe("Январь 2025 — настоящее время");
  });

  it("компания и должность не путаются местами", () => {
    expect(parsed.experience[0].companyName).toBe("Астра Медиа");
    expect(parsed.experience[0].position).toBe("Digital Group Head");
  });

  it("хвост перенесённой строки не становится должностью", () => {
    // «организация\nвыставок» — это разорванная строка про отрасли,
    // а не название должности. Такое уже случалось.
    expect(parsed.experience[0].position).not.toBe("выставок");
  });
});

describe("Разорванные названия организаций", () => {
  it("название заглавными буквами склеивается обратно", () => {
    const parsed = parseResume(`Опыт работы — 1 год

Сентябрь 2025 — КГУ ЖАСЫЛ КАРАГАНДА УПРАВЛЕНИЯ РАЗВИТИЯ
настоящее время
ПРОСТРАНСТВ ГОРОДА
1 месяц
Государственные организации`);

    expect(parsed.experience[0].companyName).toBe(
      "КГУ ЖАСЫЛ КАРАГАНДА УПРАВЛЕНИЯ РАЗВИТИЯ ПРОСТРАНСТВ ГОРОДА",
    );
    expect(parsed.experience[0].position).toBeNull();
  });

  it("название с кавычками склеивается по незакрытой кавычке", () => {
    const parsed = parseResume(`Опыт работы — 10 лет

Июнь 2011 — АО «Центр обеспечения деятельности Нацбанка
Июнь 2021
Республики Казахстан»
10 лет`);

    expect(parsed.experience[0].companyName).toBe(
      "АО «Центр обеспечения деятельности Нацбанка Республики Казахстан»",
    );
  });
});

describe("Отдельные поля", () => {
  it("«родилась» распознаётся так же, как «родился»", () => {
    // Здесь легко перепутать русскую «а» с латинской, и тогда
    // дата рождения не находится у половины кандидатов.
    expect(
      parseResume("Женщина, 27 лет, родилась 10 августа 1999").birthDate,
    ).toBe("1999-08-10");
    expect(parseResume("Мужчина, 47 лет, родился 3 мая 1979").birthDate).toBe(
      "1979-05-03",
    );
  });

  it("город берётся из шапки, а не из мест работы", () => {
    const parsed = parseResume(`Иванов Пётр
Проживает: Шымкент

Опыт работы — 2 года
Январь 2024 — Компания
настоящее время
Работал в Астане и Алматы`);

    expect(parsed.city).toBe("Шымкент");
  });

  it("незнакомый город находится по слову «город»", () => {
    expect(parseResume("Адрес: г. Жанаозен, улица Абая").city).toBe("Жанаозен");
  });

  it("желаемая должность берётся со следующей строки", () => {
    const parsed = parseResume(`Мужчина, 47 лет

Желаемая должность и зарплата
AI-инженер
1 500 $ на руки`);

    expect(parsed.currentPosition).toBe("AI-инженер");
  });
});

describe("Резюме не с hh", () => {
  it("заголовок вразрядку распознаётся как раздел", () => {
    // Дизайнерские резюме набирают заголовки «О П Ы Т  Р А Б О Т Ы».
    const parsed = parseResume(`Иванов Пётр

О П Ы Т  Р А Б О Т Ы
QA-инженер · JETI ASPAN · Астана
сен. 2025 – сен. 2026
• Тестирование мобильных приложений`);

    expect(parsed.experience).toHaveLength(1);
    expect(parsed.experience[0].position).toBe("QA-инженер");
    expect(parsed.experience[0].companyName).toBe("JETI ASPAN");
  });

  it("сокращённые месяцы понимаются как даты", () => {
    const parsed = parseResume(`Опыт работы
Аналитик · Робот · Астана
янв. 2023 – мар. 2025
- Работа с данными`);

    expect(parsed.experience[0].period).toBe("янв. 2023 – мар. 2025");
  });

  it("город из строки-заголовка не становится должностью", () => {
    const parsed = parseResume(`Опыт работы
Менеджер · Компания · Astana
май 2024 – май 2025
- Продажи`);

    expect(parsed.experience[0].position).toBe("Менеджер");
    expect(parsed.experience[0].companyName).toBe("Компания");
  });
});

describe("Имена", () => {
  it("казахские буквы не мешают найти ФИО", () => {
    expect(parseResume("Әбдіқан Арман\nМужчина, 22 года").fullName).toBe(
      "Әбдіқан Арман",
    );
    expect(parseResume("Сапар Мейірлан Мұсаұлы\nМужчина").fullName).toBe(
      "Сапар Мейірлан Мұсаұлы",
    );
    expect(parseResume("Қали Темірлан\nМужчина").fullName).toBe(
      "Қали Темірлан",
    );
  });

  it("имя латиницей тоже находится", () => {
    expect(parseResume("Bekenov Rustam\nМужчина").fullName).toBe(
      "Bekenov Rustam",
    );
  });

  it("служебные строки за имя не принимаются", () => {
    expect(parseResume("Desired position\nSales Manager").fullName).toBeNull();
  });
});

describe("Выгрузка с hh на английском", () => {
  it("дата рождения читается из «born on»", () => {
    expect(
      parseResume("Male, 22 years, born on 26 August 2004").birthDate,
    ).toBe("2004-08-26");
  });

  it("месяц, оторванный от года, собирается обратно", () => {
    // В английской выгрузке между месяцем и годом стоит компания.
    const parsed = parseResume(`Work experience — 1 year
September
Жана адамдар
2025 — till now
Astana
Спортивный менеджер`);

    expect(parsed.experience).toHaveLength(1);
    expect(parsed.experience[0].period).toBe("September 2025 — till now");
  });
});
