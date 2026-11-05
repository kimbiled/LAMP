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

// Резюме в RTF — это текст, перемешанный со служебными командами
// (\b, \par) и целыми служебными разделами: таблицей шрифтов, набором
// стилей и — главное — картинками. Картинка внутри RTF записана
// шестнадцатеричными цифрами, и её кусок легко принять за телефон:
// у пяти разных кандидатов оказался «номер» +7 445 200 00 00,
// вырезанный из заголовка одной и той же картинки.
//
// Поэтому читаем файл по-настоящему, со счётом скобок, а не заменами
// по образцу: внутри служебных разделов текста нет, и пропускаем их
// целиком вместе со всем содержимым.

// Разделы, в которых текста резюме не бывает.
const RTF_SKIP = new Set([
  "fonttbl", // список шрифтов
  "colortbl", // список цветов
  "stylesheet", // набор стилей
  "listtable",
  "listoverridetable",
  "rsidtbl",
  "revtbl",
  "filetbl",
  "xmlnstbl",
  "latentstyles",
  "info", // автор, дата создания файла
  "generator", // чем файл сделан
  "themedata",
  "colorschememapping",
  "datastore",
  "pict", // картинка
  "shppict",
  "nonshppict",
  "object", // встроенный документ
  "objdata",
]);

function rtfToText(source: string): string {
  // Русские буквы записаны кодами вида \'ef\'f0 в кодировке Windows-1251.
  // Идущие подряд коды собираем и переводим в буквы разом: по одному
  // байту кириллица не складывается.
  const decoder = new TextDecoder("windows-1251");

  const out: string[] = [];
  let bytes: number[] = [];

  const flush = () => {
    if (bytes.length > 0) {
      out.push(decoder.decode(new Uint8Array(bytes)));
      bytes = [];
    }
  };

  // Для каждой открытой скобки помним, пропускаем ли мы её содержимое.
  const skip: boolean[] = [];
  const skipping = () => skip.includes(true);

  // Сколько запасных знаков идёт после каждого символа \u — задаётся
  // командой \uc и действует до конца раздела.
  const uc: number[] = [1];

  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (ch === "{") {
      const ahead = source.slice(i + 1, i + 30);
      const ignorable = /^\\\*/.test(ahead);
      const word = /^\\\*?\\?([a-z]+)/i.exec(ahead)?.[1]?.toLowerCase() ?? "";
      skip.push(ignorable || RTF_SKIP.has(word));
      uc.push(uc[uc.length - 1]);
      i += 1;
      continue;
    }

    if (ch === "}") {
      flush();
      skip.pop();
      if (uc.length > 1) uc.pop();
      i += 1;
      continue;
    }

    if (ch === "\\") {
      const next = source[i + 1];

      // Экранированные скобка, слеш и неразрывный пробел.
      if (next === "\\" || next === "{" || next === "}") {
        if (!skipping()) {
          flush();
          out.push(next);
        }
        i += 2;
        continue;
      }

      // Байт в шестнадцатеричном виде: \'ef
      const hex = /^\\'([0-9a-f]{2})/i.exec(source.slice(i, i + 4));
      if (hex) {
        if (!skipping()) bytes.push(parseInt(hex[1], 16));
        i += 4;
        continue;
      }

      // Символ по номеру: \u1055 — так Word пишет буквы вне Windows-1251.
      const unicode = /^\\u(-?\d+) ?/.exec(source.slice(i, i + 14));
      if (unicode) {
        if (!skipping()) {
          flush();
          let code = Number(unicode[1]);
          if (code < 0) code += 65536;
          out.push(String.fromCharCode(code));
        }
        i += unicode[0].length;

        // Следом идут запасные знаки для старых программ — пропускаем их.
        let left = uc[uc.length - 1];
        while (left > 0 && i < source.length) {
          if (source.startsWith("\\'", i)) {
            i += 4;
          } else if (source[i] === "\\") {
            const command = /^\\[a-z]+-?\d* ?/i.exec(source.slice(i));
            i += command ? command[0].length : 2;
          } else if (source[i] === "{" || source[i] === "}") {
            break;
          } else {
            i += 1;
          }
          left -= 1;
        }
        continue;
      }

      // Обычная команда: \par, \tab, \fs22 …
      const command = /^\\([a-z]+)(-?\d+)? ?/i.exec(source.slice(i));
      if (command) {
        const word = command[1].toLowerCase();

        if (word === "uc") {
          uc[uc.length - 1] = Number(command[2] ?? 1);
        } else if (!skipping()) {
          if (
            word === "par" ||
            word === "pard" ||
            word === "line" ||
            word === "sect"
          ) {
            flush();
            out.push("\n");
          } else if (word === "tab" || word === "cell") {
            flush();
            out.push(" ");
          }
        }

        i += command[0].length;
        continue;
      }

      i += 1;
      continue;
    }

    // Переводы строк в самом файле — разметка, а не текст.
    if (ch === "\r" || ch === "\n") {
      i += 1;
      continue;
    }

    if (!skipping()) {
      flush();
      out.push(ch);
    }

    i += 1;
  }

  flush();
  return out.join("");
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
