import { describe, expect, it } from "vitest";
import {
  emailLink,
  firstMessage,
  normalizeTelegram,
  telLink,
  telegramByPhoneOnly,
  telegramLink,
  whatsappLink,
} from "@/lib/contacts";

describe("Кнопки связи", () => {
  it("делает ссылку для звонка из любого написания номера", () => {
    expect(telLink("+7 (701) 123-45-67")).toBe("tel:+77011234567");
    expect(telLink("87011234567")).toBe("tel:+87011234567");
  });

  it("не делает ссылку из мусора", () => {
    expect(telLink(null)).toBeNull();
    expect(telLink("123")).toBeNull();
    expect(whatsappLink("нет номера")).toBeNull();
  });

  it("делает ссылку WhatsApp с готовым текстом", () => {
    const link = whatsappLink("+7 701 123 45 67", "Здравствуйте!");
    expect(link).toContain("https://wa.me/77011234567");
    expect(link).toContain("text=");
  });

  it("приводит Telegram к единому виду", () => {
    expect(normalizeTelegram("@ivan")).toBe("ivan");
    expect(normalizeTelegram("ivan")).toBe("ivan");
    expect(normalizeTelegram("https://t.me/ivan")).toBe("ivan");
    expect(normalizeTelegram("  ")).toBeNull();
    expect(telegramLink("@ivan")).toBe("https://t.me/ivan");
  });

  it("делает ссылку на почту", () => {
    expect(emailLink("a@b.kz")).toBe("mailto:a@b.kz");
    expect(emailLink(null)).toBeNull();
  });

  it("обращается к кандидату по имени, а не по фамилии", () => {
    const message = firstMessage({
      candidateName: "Петров Иван Сергеевич",
      recruiterName: "Нариман",
      companyName: "LAMP",
      jobTitle: "Frontend-разработчик",
    });

    expect(message).toContain("Здравствуйте, Иван!");
    expect(message).toContain("Нариман");
    expect(message).toContain("«Frontend-разработчик»");
  });

  it("работает, если указано только одно слово имени", () => {
    const message = firstMessage({
      candidateName: "Иван",
      recruiterName: "Нариман",
      companyName: "LAMP",
    });

    expect(message).toContain("Здравствуйте, Иван!");
  });
});

describe("Telegram по номеру телефона", () => {
  it("открывает чат по нику, если он есть", () => {
    expect(telegramLink("@ivan", "+7 701 123 45 67")).toBe("https://t.me/ivan");
    expect(telegramByPhoneOnly("@ivan", "+7 701 123 45 67")).toBe(false);
  });

  it("открывает чат по номеру, если ника нет", () => {
    expect(telegramLink(null, "+7 (701) 123-45-67")).toBe(
      "https://t.me/+77011234567",
    );
    expect(telegramByPhoneOnly(null, "+7 701 123 45 67")).toBe(true);
  });

  it("без ника и без номера ссылки нет", () => {
    expect(telegramLink(null, null)).toBeNull();
    expect(telegramLink("", "123")).toBeNull();
    expect(telegramByPhoneOnly(null, null)).toBe(false);
  });
});
