// Достаём обычный текст из файла резюме.
//
// PDF читаем сами по координатам кусочков текста, а не сплошным потоком.
// Причина: в резюме на две колонки обычное чтение идёт слева направо
// через всю страницу и склеивает строку из левой колонки со строкой
// из правой. Получается каша, из которой ничего не разобрать.
//
// DOCX читает библиотека mammoth, простой текст и RTF — разбираем сами.

type TextPiece = {
  text: string;
  x: number;
  y: number;
  width: number;
};

export async function extractText(
  data: Buffer,
  mimeType: string,
): Promise<string> {
  if (mimeType === "application/pdf") {
    return normalize(await extractPdf(data));
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: data });
    return normalize(result.value);
  }

  if (mimeType === "text/plain") {
    return normalize(data.toString("utf8"));
  }

  if (mimeType === "application/rtf" || mimeType === "text/rtf") {
    return normalize(rtfToText(data.toString("latin1")));
  }

  return "";
}

// ---------- PDF ----------

async function extractPdf(data: Buffer): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));

  const pages: string[] = [];

  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();

    const pieces: TextPiece[] = [];
    for (const item of content.items) {
      // Кусочки без текста — это переносы и служебные метки.
      if (!("str" in item) || typeof item.str !== "string") continue;
      if (item.str.trim() === "") continue;

      // transform — это положение кусочка на странице:
      // пятое число по горизонтали, шестое по вертикали.
      const [, , , , x, y] = item.transform as number[];
      pieces.push({ text: item.str, x, y, width: item.width ?? 0 });
    }

    if (pieces.length > 0) {
      pages.push(layoutPage(pieces, page.view?.[2] ?? 595));
    }
  }

  return pages.join("\n\n");
}

// Собираем страницу обратно в читаемый текст с учётом колонок.
function layoutPage(pieces: TextPiece[], pageWidth: number): string {
  const columns = splitColumns(pieces, pageWidth);
  return columns.map((column) => buildLines(column, pageWidth)).join("\n");
}

// Есть ли на странице вертикальная полоса, которую не пересекает
// ни один кусочек текста. Если есть — это граница колонок.
function splitColumns(pieces: TextPiece[], pageWidth: number): TextPiece[][] {
  // Узкие страницы и короткие тексты делить незачем.
  if (pieces.length < 40) return [pieces];

  const step = pageWidth / 100;
  const covered = new Array(101).fill(false);

  for (const piece of pieces) {
    const from = Math.max(0, Math.floor(piece.x / step));
    const to = Math.min(100, Math.ceil((piece.x + piece.width) / step));
    for (let index = from; index <= to; index += 1) covered[index] = true;
  }

  // Ищем самый широкий свободный коридор в средней части страницы.
  let best: { start: number; end: number } | null = null;
  let start: number | null = null;

  for (let index = 20; index <= 80; index += 1) {
    if (!covered[index]) {
      if (start === null) start = index;
    } else if (start !== null) {
      const candidate = { start, end: index - 1 };
      if (!best || candidate.end - candidate.start > best.end - best.start) {
        best = candidate;
      }
      start = null;
    }
  }

  if (start !== null) {
    const candidate = { start, end: 80 };
    if (!best || candidate.end - candidate.start > best.end - best.start) {
      best = candidate;
    }
  }

  // Коридор уже пяти процентов ширины — это обычные отступы,
  // а не граница колонок.
  if (!best || best.end - best.start < 5) return [pieces];

  const border = ((best.start + best.end) / 2) * step;
  const left = pieces.filter((piece) => piece.x + piece.width / 2 < border);
  const right = pieces.filter((piece) => piece.x + piece.width / 2 >= border);

  // Если в одной из колонок почти ничего нет, делить не стоит.
  if (left.length < 10 || right.length < 10) return [pieces];

  return [left, right];
}

// Кусочки с примерно одинаковой высотой — это одна строка.
function buildLines(pieces: TextPiece[], pageWidth: number): string {
  const sorted = [...pieces].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: string[] = [];
  let current: TextPiece[] = [];
  let lineY: number | null = null;

  for (const piece of sorted) {
    if (lineY === null || Math.abs(piece.y - lineY) <= 3) {
      current.push(piece);
      lineY = lineY ?? piece.y;
    } else {
      lines.push(...splitLine(current, pageWidth));
      current = [piece];
      lineY = piece.y;
    }
  }

  if (current.length > 0) lines.push(...splitLine(current, pageWidth));

  return lines.join("\n");
}

// Внутри строки кусочки идут слева направо. Небольшой разрыв — это
// пробел между словами, а большой — соседняя ячейка таблицы.
//
// Так свёрстаны выгрузки с сайтов вакансий: слева период работы,
// справа название компании. Это разные данные, и склеивать их в одну
// строку нельзя — иначе период перестаёт распознаваться.
function splitLine(pieces: TextPiece[], pageWidth: number): string[] {
  const sorted = [...pieces].sort((a, b) => a.x - b.x);
  const bigGap = pageWidth * 0.06;

  const lines: string[] = [];
  let line = "";
  let previousEnd: number | null = null;

  for (const piece of sorted) {
    if (previousEnd !== null) {
      const gap = piece.x - previousEnd;

      if (gap > bigGap) {
        lines.push(line.trim());
        line = "";
      } else if (gap > 1 && !line.endsWith(" ")) {
        line += " ";
      }
    }

    line += piece.text;
    previousEnd = piece.x + piece.width;
  }

  if (line.trim() !== "") lines.push(line.trim());

  return lines;
}

// ---------- RTF ----------

// Простое резюме в RTF — это текст, перемешанный со служебными
// командами вида \b и \par. Убираем команды, оставляем текст.
//
// Русские буквы записаны кодами вида \'ef\'f0 в кодировке Windows-1251,
// поэтому идущие подряд коды собираем и переводим в буквы разом.
function rtfToText(source: string): string {
  const decoder = new TextDecoder("windows-1251");

  return source
    .replace(/(?:\\'[0-9a-f]{2})+/gi, (run) => {
      const bytes = [...run.matchAll(/\\'([0-9a-f]{2})/gi)].map((match) =>
        parseInt(match[1], 16),
      );
      return decoder.decode(new Uint8Array(bytes));
    })
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\line\b/g, "\n")
    .replace(/\\tab\b/g, " ")
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\[a-z]+-?\d*\s?/gi, "")
    .replace(/[{}]/g, "");
}

// ---------- общее ----------

// Приводим текст к единому виду: убираем лишние пробелы и пустые строки,
// чтобы дальше его было проще разбирать.
function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
