import { describe, expect, it } from "vitest";
import { extractText } from "@/lib/resume/extract-text";
import { parseResume } from "@/lib/resume/parse";

// Резюме в формате RTF — это текст вперемешку со служебными разделами.
// Главная ловушка: картинка внутри файла записана шестнадцатеричными
// цифрами, и её кусок легко принять за телефон. Именно так у пяти разных
// кандидатов оказался один «номер» +7 445 200 00 00, вырезанный
// из заголовка картинки, и система объявила их дублями друг друга.

// Образец повторяет строение настоящего резюме из Word:
// таблица шрифтов, таблица цветов, служебная пометка, картинка
// и только потом текст.
const RTF = String.raw`{\rtf1\ansi\ansicpg1251\deff0\uc1
{\fonttbl{\f0\fnil\fcharset204 Arial;}{\f1\fnil\fcharset0 Calibri;}}
{\colortbl ;\red0\green0\blue0;\red68\green114\blue196;}
{\*\generator Riched20 10.0.19041;}
{\pict\pngblip\picw48\pich48\picwgoal720\pichgoal720
89504e470d0a1a0a0000000d49484452000000480000004808030000006233437500000210504c5445
4c6971a0a0a0ffffff000000d4d4d4e8e8e82874524f0000000970485973000000}
\pard\f0\fs22 \'c4\'ee\'eb\'e4\'e0\'e5\'e2\'e0 \'c0\'ff\'ed\'e0\par
\u1240? \'f1\'e5\'ea\'f6\'e8\'ff\par
+7 705 153 21 91\par
doldaevaa009@gmail.com\par
}`;

describe("Чтение резюме в формате RTF", () => {
  it("не тащит картинку в текст", async () => {
    const text = await extractText(
      Buffer.from(RTF, "latin1"),
      "application/rtf",
    );

    // Длинная цепочка шестнадцатеричных цифр — верный признак того,
    // что содержимое картинки попало в текст.
    expect(text).not.toMatch(/[0-9a-f]{40,}/i);
    expect(text).not.toContain("89504e47");
    expect(text).not.toContain("49484452");
  });

  it("не оставляет служебные таблицы", async () => {
    const text = await extractText(
      Buffer.from(RTF, "latin1"),
      "application/rtf",
    );

    expect(text).not.toContain("Arial");
    expect(text).not.toContain("Calibri");
    expect(text).not.toContain("Riched20");
  });

  it("читает русские буквы", async () => {
    const text = await extractText(
      Buffer.from(RTF, "latin1"),
      "application/rtf",
    );

    expect(text).toContain("Долдаева Аяна");
    expect(text).toContain("Ә секция");
  });

  it("читает казахские буквы, записанные номером символа", async () => {
    const text = await extractText(
      Buffer.from(RTF, "latin1"),
      "application/rtf",
    );

    // \u1240 — это Ә. Так Word записывает буквы, которых нет
    // в кодировке Windows-1251.
    expect(text).toContain("Ә");
  });

  it("находит настоящий телефон, а не цифры из картинки", async () => {
    const text = await extractText(
      Buffer.from(RTF, "latin1"),
      "application/rtf",
    );
    const parsed = parseResume(text);

    expect(parsed.phone).toBe("+7 705 153 21 91");
    expect(parsed.email).toBe("doldaevaa009@gmail.com");
  });
});
