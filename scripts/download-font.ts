// Обновление шрифта интерфейса.
//
// Шрифт Inter лежит в папке public/fonts и не скачивается во время
// работы приложения. Так сделано намеренно: раньше он подключался
// через next/font/google, и сервер ходил в сеть при каждой отрисовке
// страницы. Когда до Google не достучаться, он ждёт ответа — страница
// подвисает на секунду-две.
//
// Этот скрипт нужен редко: когда выйдет новая версия шрифта или
// понадобится ещё один алфавит. Запуск:
//
//   npm run font:download
//
// После запуска проверьте, что страницы по-прежнему выглядят как надо,
// и закоммитьте изменившиеся файлы вместе с правками в globals.css.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Алфавиты, которые нужны системе.
// cyrillic-ext обязателен: казахские Ә, Қ, Ң, Ө, Ү, Һ лежат именно там,
// а не в обычной кириллице.
const SUBSETS = ["latin", "latin-ext", "cyrillic", "cyrillic-ext"];

const FONT_DIR = join(process.cwd(), "public", "fonts");

// Без этого Google отдаёт устаревший формат вместо woff2.
const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SOURCE =
  "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap";

async function main() {
  console.log("Запрашиваем список файлов у Google…");

  const response = await fetch(SOURCE, { headers: { "User-Agent": BROWSER } });
  if (!response.ok) {
    throw new Error(`Google ответил ${response.status}`);
  }

  const css = await response.text();

  // В ответе каждый алфавит идёт отдельным блоком с комментарием-названием.
  const blocks = [
    ...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]+)\}/g),
  ];
  if (blocks.length === 0) {
    throw new Error("Не удалось разобрать ответ Google — формат изменился");
  }

  await mkdir(FONT_DIR, { recursive: true });

  const faces: string[] = [];

  for (const [, subset, body] of blocks) {
    if (!SUBSETS.includes(subset)) continue;

    const url = body.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    const range = body.match(/unicode-range: ([^;]+);/)?.[1];

    if (!url || !range) {
      throw new Error(`Для алфавита «${subset}» не нашлись файл или диапазон`);
    }

    const file = `inter-${subset}.woff2`;
    const data = Buffer.from(await (await fetch(url)).arrayBuffer());
    await writeFile(join(FONT_DIR, file), data);

    console.log(`  ${file} — ${Math.round(data.length / 1024)} КБ`);

    faces.push(
      [
        `/* ${subset} */`,
        `@font-face {`,
        `  font-family: "Inter";`,
        `  font-style: normal;`,
        `  font-weight: 100 900;`,
        `  font-display: swap;`,
        `  src: url("/fonts/${file}") format("woff2");`,
        `  unicode-range: ${range};`,
        `}`,
      ].join("\n"),
    );
  }

  if (faces.length !== SUBSETS.length) {
    throw new Error(
      `Скачано ${faces.length} алфавитов из ${SUBSETS.length} — проверьте список SUBSETS`,
    );
  }

  console.log(
    "\nГотово. Если диапазоны букв изменились, замените блоки @font-face\n" +
      "в начале src/app/globals.css на эти:\n",
  );
  console.log(faces.join("\n\n"));
}

main().catch((error) => {
  console.error("Не получилось:", error.message);
  process.exit(1);
});
