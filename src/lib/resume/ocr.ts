// Выполняется только на сервере: и распознавание, и работа с файлами.
// Пометки server-only здесь нет намеренно — иначе этот модуль нельзя
// было бы прогнать из проверочного скрипта npm run resume:check.
import path from "node:path";
import { SKILLS } from "./skills";

// Распознавание текста с картинок — Tesseract, целиком на нашем сервере.
//
// Ни одна страница резюме никуда не отправляется: библиотека работает
// локально. Из сети скачиваются только языковые словари, один раз,
// и складываются в папку .tessdata рядом с проектом.
//
// Русский и английский вместе: резюме почти всегда смешанные —
// «Frontend-разработчик», «ТОО Кселл», «Kubernetes».

const LANGS = "rus+eng";
const CACHE_DIR = path.join(process.cwd(), ".tessdata");

// Больше пяти страниц в резюме почти не бывает, а каждая страница
// скана — это несколько секунд работы. Ограничение бережёт сервер
// от файла на сто страниц.
const MAX_OCR_PAGES = 5;

// Ниже этого объёма текста считаем, что текстового слоя в PDF нет:
// это скан, и читать его надо картинкой.
export const TEXT_LAYER_THRESHOLD = 200;

type Worker = {
  recognize: (image: Buffer) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
};

// Создание работника занимает больше секунды, поэтому держим один
// на весь процесс. Hot reload в разработке пересоздаёт модули,
// поэтому храним его там же, где и подключение к базе, — в globalThis.
const globalForOcr = globalThis as unknown as {
  lampOcrWorker?: Promise<Worker> | undefined;
  lampOcrQueue?: Promise<unknown> | undefined;
};

async function getWorker(): Promise<Worker> {
  if (!globalForOcr.lampOcrWorker) {
    globalForOcr.lampOcrWorker = (async () => {
      const { createWorker } = await import("tesseract.js");
      return (await createWorker(LANGS, undefined, {
        cachePath: CACHE_DIR,
      })) as unknown as Worker;
    })();
  }

  return globalForOcr.lampOcrWorker;
}

// Работник умеет распознавать только одну картинку за раз. Если два
// рекрутера одновременно загрузят сканы, без очереди они помешают
// друг другу. Очередь — цепочка промисов: каждый ждёт предыдущего.
function queued<T>(task: () => Promise<T>): Promise<T> {
  const previous = globalForOcr.lampOcrQueue ?? Promise.resolve();
  const next = previous.then(task, task);

  // Ошибку в хвосте гасим, иначе она уронит следующего в очереди.
  globalForOcr.lampOcrQueue = next.catch(() => undefined);

  return next;
}

export async function recognizeImage(image: Buffer): Promise<string> {
  return queued(async () => {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);

    // Сразу чиним латиницу, прочитанную как кириллица: дальше по
    // конвейеру текст уже должен быть пригоден для поиска навыков.
    return fixMixedScript(
      data.text,
      SKILLS.map((skill) => skill.name),
    );
  });
}

// Скан в PDF: каждую страницу превращаем в картинку и распознаём.
// Масштаб 2 — примерно 150 точек на дюйм: буквы уже чёткие,
// а картинка ещё не гигантская.
export async function recognizePdf(data: Buffer): Promise<string> {
  const { getDocumentProxy, renderPageAsImage } = await import("unpdf");

  const file = new Uint8Array(data);
  const pdf = await getDocumentProxy(file);
  const pages = Math.min(pdf.numPages, MAX_OCR_PAGES);

  const texts: string[] = [];

  for (let page = 1; page <= pages; page += 1) {
    const image = await renderPageAsImage(file, page, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: 2,
    });

    texts.push(await recognizeImage(Buffer.from(image)));
  }

  return texts.join("\n\n");
}

// ---------- Починка латиницы, прочитанной как кириллица ----------
//
// Распознавание часто путает похожие буквы: «Backend» превращается
// в «ВасКепа». Для человека это читается, а поиск по навыкам ломается.
//
// Лечим словарём, без всякого интеллекта: слово целиком из кириллицы
// переводим по таблице похожих букв в латиницу и сверяем со списком
// известных слов. Совпало с точностью до одной буквы — заменяем.
// Порог в одну букву выбран так, чтобы обычные русские слова
// не попадали под замену: «мастер» → «mactep» отличается от «master»
// на две буквы и остаётся нетронутым.

const LOOKALIKE: Record<string, string> = {
  А: "A",
  В: "B",
  Е: "E",
  К: "K",
  М: "M",
  Н: "H",
  О: "O",
  Р: "P",
  С: "C",
  Т: "T",
  У: "Y",
  Х: "X",
  а: "a",
  в: "b",
  е: "e",
  к: "k",
  м: "m",
  н: "h",
  о: "o",
  р: "p",
  с: "c",
  т: "t",
  у: "y",
  х: "x",
  п: "n",
  г: "r",
};

// Слова, которые в резюме почти всегда написаны латиницей.
const LATIN_HINTS = [
  "backend",
  "frontend",
  "fullstack",
  "developer",
  "engineer",
  "designer",
  "manager",
  "analyst",
  "marketing",
  "product",
  "project",
  "senior",
  "junior",
  "middle",
  "lead",
  "head",
  "devops",
  "support",
  "sales",
  "software",
  "mobile",
  "android",
  "recruiter",
  "director",
  "planner",
  "buyer",
  "media",
  "digital",
  "specialist",
  "consultant",
  "architect",
];

function transliterate(word: string): string | null {
  let result = "";

  for (const letter of word) {
    if (/[A-Za-z0-9.+#-]/.test(letter)) {
      result += letter;
      continue;
    }

    const latin = LOOKALIKE[letter];
    // Буква без латинского двойника — значит слово действительно русское.
    if (!latin) return null;

    result += latin;
  }

  return result;
}

// Расстояние Левенштейна: сколько букв нужно изменить, чтобы
// одно слово стало другим.
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[b.length];
}

export function fixMixedScript(
  text: string,
  extraWords: string[] = [],
): string {
  const dictionary = [
    ...LATIN_HINTS,
    ...extraWords.map((w) => w.toLowerCase()),
  ];

  return text.replace(/[А-Яа-яЁё]{5,}/g, (word) => {
    const latin = transliterate(word);
    if (!latin) return word;

    const lower = latin.toLowerCase();
    const match = dictionary.find((hint) => distance(lower, hint) <= 1);
    if (!match) return word;

    // Возвращаем слово в написании словаря, сохранив заглавную букву.
    return /^[А-ЯЁ]/.test(word)
      ? match[0].toUpperCase() + match.slice(1)
      : match;
  });
}

// Остановить распознавание. В веб-приложении не нужно — работник живёт
// вместе с сервером. Нужно скриптам: без этого процесс не завершается,
// потому что работник держит открытый поток.
export async function shutdownOcr(): Promise<void> {
  const worker = globalForOcr.lampOcrWorker;
  if (!worker) return;

  globalForOcr.lampOcrWorker = undefined;
  await (await worker).terminate();
}
