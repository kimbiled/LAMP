import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import {
  descriptionLines,
  experienceDuration,
  isHeading,
} from "@/lib/experience-format";
import { formatDate, formatMoney } from "@/lib/format";
import {
  exportHeading,
  experienceText,
  type CandidatePdfData,
} from "@/lib/pdf/candidate-resume";

// Резюме кандидата файлом Word (DOCX).
//
// Содержание то же, что у PDF: шапка, опыт, образование, навыки, языки.
// Word нужен, когда резюме хотят поправить перед отправкой — например,
// убрать лишнее место работы или дописать комментарий от себя.
//
// Шрифт Arial: он есть на любом компьютере и содержит казахские буквы.

const FONT = "Arial";
const INK = "181818";
const SOFT = "5F5B54";
const ACCENT = "F2C35B";

function text(value: string, options: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text: value,
    font: FONT,
    bold: options.bold,
    // Размер в Word задаётся в половинках пункта: 22 — это 11 pt.
    size: options.size ?? 21,
    color: options.color ?? INK,
  });
}

function sectionTitle(title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 120 },
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 } },
    children: [text(title.toUpperCase(), { bold: true, size: 20, color: SOFT })],
  });
}

function plainParagraph(
  value: string,
  options: { color?: string; size?: number; bold?: boolean; after?: number } = {},
) {
  return new Paragraph({
    spacing: { after: options.after ?? 40 },
    children: [text(value, options)],
  });
}

function experienceBlock(item: CandidatePdfData["experience"][number]): Paragraph[] {
  const length = experienceDuration(item.period);
  const when = [item.period, length].filter(Boolean).join(" · ");
  const result: Paragraph[] = [
    new Paragraph({
      keepNext: true,
      spacing: { before: 200, after: 20 },
      children: [text(item.position ?? "Должность не указана", { bold: true, size: 23 })],
    }),
    new Paragraph({
      keepNext: true,
      spacing: { after: 60 },
      children: [
        text(item.companyName),
        ...(when ? [text(`  ·  ${when}`, { color: SOFT, size: 19 })] : []),
      ],
    }),
  ];

  const lines = item.description ? descriptionLines(item.description) : [];
  const single = lines.length === 1;
  for (const line of lines) {
    if (single) {
      result.push(plainParagraph(line));
    } else if (isHeading(line)) {
      result.push(
        new Paragraph({
          keepNext: true,
          spacing: { before: 80, after: 20 },
          children: [text(line, { bold: true })],
        }),
      );
    } else {
      result.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 20 },
          children: [text(line)],
        }),
      );
    }
  }

  return result;
}

function headerBlock(data: CandidatePdfData): (Paragraph | Table)[] {
  const heading = exportHeading(data);

  const facts = [
    { label: "Опыт работы", value: experienceText(data) },
    {
      label: "Зарплатные ожидания",
      value:
        data.salaryExpectation !== null
          ? formatMoney(data.salaryExpectation, data.currency)
          : null,
    },
    ...(data.showContacts
      ? [
          { label: "Телефон", value: data.phone },
          { label: "Email", value: data.email },
          { label: "Telegram", value: data.telegram ? `@${data.telegram}` : null },
        ]
      : []),
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));

  const textBlock: Paragraph[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [text(heading.name, { bold: true, size: 36 })],
    }),
    ...(data.currentPosition
      ? [plainParagraph(data.currentPosition, { size: 24, after: 40 })]
      : []),
    ...(heading.meta ? [plainParagraph(heading.meta, { color: SOFT, after: 120 })] : []),
    ...facts.map(
      (fact) =>
        new Paragraph({
          spacing: { after: 20 },
          children: [
            text(`${fact.label}: `, { color: SOFT, size: 19 }),
            text(fact.value, { bold: true, size: 20 }),
          ],
        }),
    ),
  ];

  if (!data.photo) return textBlock;

  // Фото и текст рядом — таблица без рамок, как это обычно делают в Word.
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const borders = { top: none, bottom: none, left: none, right: none };

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { ...borders, insideHorizontal: none, insideVertical: none },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: 22, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      type: "jpg",
                      data: data.photo,
                      transformation: { width: 110, height: 140 },
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders,
              width: { size: 78, type: WidthType.PERCENTAGE },
              children: textBlock,
            }),
          ],
        }),
      ],
    }),
  ];
}

export async function renderCandidateDocx(data: CandidatePdfData): Promise<Buffer> {
  const heading = exportHeading(data);
  const body: (Paragraph | Table)[] = [...headerBlock(data)];

  if (data.experience.length > 0) {
    body.push(sectionTitle("Опыт работы"));
    for (const item of data.experience) body.push(...experienceBlock(item));
  }

  if (data.education.length > 0) {
    body.push(sectionTitle("Образование"));
    for (const item of data.education) {
      body.push(
        new Paragraph({
          keepNext: Boolean(item.specialty || item.years),
          spacing: { before: 120, after: 20 },
          children: [text(item.institution, { bold: true })],
        }),
      );
      const soft = [item.specialty, item.years].filter(Boolean).join(" · ");
      if (soft) body.push(plainParagraph(soft, { color: SOFT }));
    }
  }

  if (data.skills.length > 0) {
    body.push(sectionTitle("Навыки"));
    body.push(plainParagraph(data.skills.join(" · ")));
  }

  if (data.languages.length > 0) {
    body.push(sectionTitle("Языки"));
    body.push(plainParagraph(data.languages.join(" · ")));
  }

  const document = new Document({
    title: `${heading.name} — резюме`,
    creator: data.companyName,
    description: "Резюме, выгруженное из LAMP",
    sections: [
      {
        properties: {
          page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  text(`${data.companyName} · ${formatDate(new Date())} · стр. `, {
                    color: SOFT,
                    size: 16,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT,
                    size: 16,
                    color: SOFT,
                  }),
                ],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });

  return Packer.toBuffer(document);
}
