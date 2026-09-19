// Достаём обычный текст из файла резюме.
// PDF читаем библиотекой unpdf, DOCX — библиотекой mammoth.

export async function extractText(
  data: Buffer,
  mimeType: string,
): Promise<string> {
  if (mimeType === "application/pdf") {
    const { extractText: extractPdfText, getDocumentProxy } = await import(
      "unpdf"
    );
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const result = await extractPdfText(pdf, { mergePages: true });
    return normalize(
      Array.isArray(result.text) ? result.text.join("\n") : result.text,
    );
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: data });
    return normalize(result.value);
  }

  return "";
}

// Приводим текст к единому виду: убираем лишние пробелы и пустые строки,
// чтобы дальше его было проще разбирать.
function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
