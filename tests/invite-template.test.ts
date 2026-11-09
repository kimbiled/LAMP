import { describe, expect, it } from "vitest";
import { DEFAULT_INVITE_TEMPLATE, fillInviteTemplate } from "@/lib/invite-template";

describe("шаблон приглашения", () => {
  const values = {
    имя: "Айгерим",
    вакансия: "Бухгалтер",
    дата: "12 ноября, среда",
    время: "15:00",
    длительность: "45 минут",
    ссылка: "https://meet.google.com/abc-defg-hij",
    компания: "ТОО Ромашка",
    рекрутер: "Анна",
  };

  it("подставляет все метки", () => {
    const text = fillInviteTemplate(DEFAULT_INVITE_TEMPLATE, values);
    expect(text).toContain("Здравствуйте, Айгерим!");
    expect(text).toContain("«Бухгалтер» в компанию ТОО Ромашка");
    expect(text).toContain("Ссылка на встречу: https://meet.google.com/abc-defg-hij");
    expect(text).not.toMatch(/\{[^}]+\}/);
  });

  it("убирает строку, если для неё нет значения", () => {
    const text = fillInviteTemplate(DEFAULT_INVITE_TEMPLATE, { ...values, ссылка: "" });
    expect(text).not.toContain("Ссылка на встречу");
    expect(text).toContain("Время: 15:00");
  });

  it("пустой шаблон — значит шаблон по умолчанию", () => {
    expect(fillInviteTemplate("   ", values)).toContain("Здравствуйте, Айгерим!");
  });

  it("незнакомые метки оставляет как есть", () => {
    expect(fillInviteTemplate("Привет, {имя}! {адрес}", values)).toBe(
      "Привет, Айгерим! {адрес}",
    );
  });

  it("метки не зависят от регистра", () => {
    expect(fillInviteTemplate("{Имя}, {ДАТА}", values)).toBe("Айгерим, 12 ноября, среда");
  });
});
