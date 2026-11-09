import { describe, expect, it } from "vitest";
import { DEFAULT_INVITE_TEMPLATE, fillInviteTemplate } from "@/lib/invite-template";

describe("шаблон приглашения", () => {
  const base = {
    name: "Айгерим",
    company: "ТОО Ромашка",
    position: "Аналитик",
    date: "12 ноября, четверг",
    time: "15:00",
    address: "Астана, Туран 53В",
    room: "305",
    recruiter: "Анна",
  };

  it("онлайн: есть ссылка — остаётся блок со ссылкой, адреса нет", () => {
    const text = fillInviteTemplate(DEFAULT_INVITE_TEMPLATE, {
      ...base,
      link: "https://meet.google.com/abc-defg-hij",
    });
    expect(text).toContain("Здравствуйте, Айгерим!");
    expect(text).toContain("в компанию ТОО Ромашка на позицию Аналитик");
    expect(text).toContain("• Формат: Онлайн");
    expect(text).toContain("Ссылка для подключения: https://meet.google.com/abc-defg-hij");
    expect(text).not.toContain("Адрес");
    expect(text).not.toContain("Если онлайн");
    expect(text).not.toContain("Если офлайн");
    expect(text).not.toMatch(/\[[^\]]+\]/);
  });

  it("офлайн: нет ссылки — адрес и кабинет, без ссылки", () => {
    const text = fillInviteTemplate(DEFAULT_INVITE_TEMPLATE, base);
    expect(text).toContain("• Формат: Офлайн");
    expect(text).toContain("Адрес: Астана, Туран 53В");
    expect(text).toContain("Кабинет: 305");
    expect(text).not.toContain("Ссылка для подключения");
  });

  it("пустой кабинет — строка убирается", () => {
    const text = fillInviteTemplate(DEFAULT_INVITE_TEMPLATE, { ...base, room: "" });
    expect(text).not.toContain("Кабинет");
    expect(text).toContain("Адрес: Астана");
  });

  it("пустой шаблон — значит шаблон по умолчанию", () => {
    expect(fillInviteTemplate("   ", base)).toContain("Здравствуйте, Айгерим!");
  });

  it("незнакомые метки оставляет как есть, старые фигурные понимает", () => {
    expect(fillInviteTemplate("Привет, {имя}! [Парковка]", base)).toBe(
      "Привет, Айгерим! [Парковка]",
    );
  });
});
