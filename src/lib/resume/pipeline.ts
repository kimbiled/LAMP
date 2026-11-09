// Выполняется только на сервере. Пометки server-only нет намеренно:
// так конвейер можно прогнать из скрипта npm run resume:check.
import { extractText } from "./extract-text";
import { recognizeImage, recognizePdf, TEXT_LAYER_THRESHOLD } from "./ocr";
import {
  extractPhotoFromDocx,
  extractPhotoFromPdf,
  type ExtractedPhoto,
} from "./photo";
import { parseResume, type ParsedResume } from "./parse";
import { findSkills } from "./skills";
import { parseQuality, totalExperienceMonths } from "./score";

// Обработка резюме: от файла до готовых полей.
//
// Весь разбор идёт на нашем сервере. Никакие искусственные интеллекты
// не используются — ни свои, ни чужие. Только правила, шаблоны
// и словари, поэтому один и тот же файл всегда даёт один результат
// и любое поле можно объяснить: вот строка, из которой оно взято.
//
// Этапы:
//   1. Определяем тип файла.
//   2. Достаём текст: из PDF — слой текста, из DOCX — разметку,
//      из картинки — распознаванием, из скана PDF — тоже.
//   3. Режем текст на разделы по заголовкам.
//   4. Достаём поля шаблонами: телефон, почта, даты, места работы.
//   5. Находим навыки по словарю — по всему тексту, а не только
//      в разделе «Ключевые навыки».
//   6. Считаем показатели: стаж по датам, полноту распознавания.
//
// Результат уходит в базу, дальше его проверяет человек.

export type TextSource =
  "PDF_TEXT" | "PDF_OCR" | "DOCX" | "IMAGE_OCR" | "PLAIN";

export const TEXT_SOURCE_LABELS: Record<TextSource, string> = {
  PDF_TEXT: "текстовый слой PDF",
  PDF_OCR: "распознано с изображения PDF",
  DOCX: "документ Word",
  IMAGE_OCR: "распознано с картинки",
  PLAIN: "обычный текст",
};

export type ProcessedResume = {
  text: string;
  source: TextSource;
  parsed: ParsedResume;
  // Навыки из словаря плюс то, что нашлось в разделе «Навыки».
  skills: string[];
  experienceMonths: number;
  quality: { score: number; missing: string[] };
  // Фотография, если нашлась в файле. Необязательна: у половины
  // резюме её просто нет.
  photo: ExtractedPhoto | null;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function processResume(
  data: Buffer,
  mimeType: string,
): Promise<ProcessedResume> {
  const { text, source } = await extractAnything(data, mimeType);

  // Фото ищем в PDF и в Word: там оно лежит отдельной картинкой.
  // В сканах и фотографиях страницы пришлось бы искать лицо на листе,
  // а это уже совсем другая задача.
  const photo =
    mimeType === "application/pdf"
      ? await extractPhotoFromPdf(data)
      : mimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ? await extractPhotoFromDocx(data)
        : null;

  const parsed = parseResume(text);

  // Навыки из словаря объединяем с тем, что человек сам перечислил
  // в резюме: словарь знает не всё, а раздел «Навыки» — не всегда есть.
  const skills = Array.from(new Set([...findSkills(text), ...parsed.skills]));

  const withSkills: ParsedResume = { ...parsed, skills };

  return {
    text,
    source,
    parsed: withSkills,
    skills,
    experienceMonths: totalExperienceMonths(withSkills.experience),
    quality: parseQuality(withSkills),
    photo,
  };
}

// Этап 2: получить текст любым доступным способом.
async function extractAnything(
  data: Buffer,
  mimeType: string,
): Promise<{ text: string; source: TextSource }> {
  if (IMAGE_TYPES.includes(mimeType)) {
    return { text: await recognizeImage(data), source: "IMAGE_OCR" };
  }

  const text = await extractText(data, mimeType);

  // В PDF может не быть текстового слоя: это скан или фотография
  // страницы. Тогда переходим к распознаванию.
  if (mimeType === "application/pdf" && text.length < TEXT_LAYER_THRESHOLD) {
    const recognized = await recognizePdf(data);

    // Берём то, что получилось длиннее: иногда в скане всё-таки есть
    // обрывки текстового слоя, и они точнее распознавания.
    if (recognized.trim().length > text.length) {
      return { text: recognized, source: "PDF_OCR" };
    }
  }

  if (mimeType === "application/pdf") {
    return { text, source: "PDF_TEXT" };
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return { text, source: "DOCX" };
  }

  return { text, source: "PLAIN" };
}
