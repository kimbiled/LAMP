import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { extractText, getDocumentProxy } from "unpdf";
import {
  renderCandidatePdf,
  type CandidatePdfData,
} from "@/lib/pdf/candidate-resume";

// Выгрузка резюме в PDF: файл собирается, текст в нём настоящий
// (а не картинка), казахские буквы и ₸ на месте, длинное резюме
// переходит на следующие страницы, а вариант «без контактов»
// действительно без контактов.

function photoJpeg(): Buffer {
  const canvas = createCanvas(240, 300);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#c9b28a";
  ctx.fillRect(0, 0, 240, 300);
  return canvas.toBuffer("image/jpeg", 85);
}

const duties = [
  "Обязанности:",
  ...Array.from(
    { length: 12 },
    (_, i) =>
      `Вёл переговоры с поставщиками и контролировал исполнение договоров, пункт ${i + 1}, с отчётностью перед руководством`,
  ),
  "Достижения:",
  "1 - Сократил сроки закупки на 30%",
  "React · TypeScript · Next.js",
].join("\n");

const base: CandidatePdfData = {
  fullName: "Әлібекова Қуаныш Өмірзаққызы",
  currentPosition: "Менеджер по закупкам",
  city: "Алматы",
  birthDate: new Date("1994-03-12T00:00:00Z"),
  experienceYears: null,
  experienceMonths: 75,
  salaryExpectation: 650000,
  currency: "KZT",
  phone: "+7 701 000 00 00",
  email: "kuanysh@example.kz",
  telegram: "kuanysh",
  skills: ["1С", "Переговоры", "Excel", "Тендеры"],
  languages: ["Казахский — родной", "Русский — свободно"],
  experience: Array.from({ length: 5 }, (_, i) => ({
    id: `e${i}`,
    companyName: `ТОО «Компания ${i + 1}»`,
    position: "Менеджер по закупкам",
    period: "Март 2021 — Июль 2024",
    description: duties,
  })),
  education: [
    {
      id: "ed1",
      institution: "Казахский национальный университет им. аль-Фараби",
      specialty: "Экономика",
      years: "2015",
    },
  ],
  photo: photoJpeg(),
  companyName: "Тестовая компания",
  showContacts: true,
};

async function textOf(pdf: Buffer) {
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const { totalPages, text } = await extractText(doc, { mergePages: true });
  return { totalPages, text };
}

describe("резюме в PDF", () => {
  it("собирает многостраничный файл с текстом, фото и подвалом", async () => {
    const pdf = await renderCandidatePdf(base);
    if (process.env.PDF_TEST_OUT) {
      writeFileSync(`${process.env.PDF_TEST_OUT}/long.pdf`, pdf);
    }

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

    const { totalPages, text } = await textOf(pdf);
    expect(totalPages).toBeGreaterThan(1);
    expect(text).toContain("Әлібекова Қуаныш Өмірзаққызы");
    expect(text).toContain("650 000 ₸");
    expect(text).toContain("6 лет 3 месяца");
    expect(text).toContain("+7 701 000 00 00");
    expect(text).toContain("Тестовая компания");
    expect(text).toContain(`1 / ${totalPages}`);
  }, 60_000);

  it("без контактов не содержит телефона, почты и Telegram", async () => {
    const pdf = await renderCandidatePdf({ ...base, showContacts: false });
    const { text } = await textOf(pdf);

    expect(text).toContain("Әлібекова");
    expect(text).not.toContain("+7 701 000 00 00");
    expect(text).not.toContain("kuanysh@example.kz");
    expect(text).not.toContain("@kuanysh");
  }, 60_000);

  it("собирается и почти без данных", async () => {
    const pdf = await renderCandidatePdf({
      ...base,
      currentPosition: null,
      city: null,
      birthDate: null,
      experienceMonths: null,
      salaryExpectation: null,
      phone: null,
      email: null,
      telegram: null,
      skills: [],
      languages: [],
      experience: [],
      education: [],
      photo: null,
    });
    const { text } = await textOf(pdf);
    expect(text).toContain("Әлібекова");
  }, 60_000);
});
