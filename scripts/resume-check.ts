import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { processResume } from "../src/lib/resume/pipeline";
import { formatMonths } from "../src/lib/resume/score";
import { shutdownOcr } from "../src/lib/resume/ocr";

// Проверка качества распознавания на настоящих резюме.
//
// Положите файлы в папку и запустите:
//   npm run resume:check -- C:/Users/user/Desktop/резюме
//
// Скрипт прочитает каждый файл, покажет, что распозналось, и в конце
// подсчитает, сколько процентов полей находится. Никуда ничего не
// отправляется: файлы читаются на вашем компьютере.
//
// Ключ --text выводит распознанный текст целиком — полезно, когда
// непонятно, почему поле не нашлось:
//   npm run resume:check -- путь/к/папке --text

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".rtf": "application/rtf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

const FIELDS = [
  "fullName",
  "phone",
  "email",
  "city",
  "currentPosition",
  "birthDate",
  "experience",
  "education",
] as const;

const LABELS: Record<(typeof FIELDS)[number], string> = {
  fullName: "ФИО",
  phone: "телефон",
  email: "почта",
  city: "город",
  currentPosition: "должность",
  birthDate: "дата рождения",
  experience: "опыт работы",
  education: "образование",
};

async function main() {
  const args = process.argv.slice(2);
  const showText = args.includes("--text");
  const folder = args.find((arg) => !arg.startsWith("--"));

  if (!folder) {
    console.log("Укажите папку с резюме:");
    console.log("  npm run resume:check -- C:/путь/к/папке");
    return;
  }

  const entries = await readdir(folder);
  const files = entries.filter((name) =>
    Object.keys(TYPES).includes(path.extname(name).toLowerCase()),
  );

  if (files.length === 0) {
    console.log(
      `В папке нет резюме (PDF, DOCX, RTF, TXT, JPG, PNG): ${folder}`,
    );
    return;
  }

  const found: Record<string, number> = {};
  for (const field of FIELDS) found[field] = 0;

  let unreadable = 0;

  for (const name of files) {
    const data = await readFile(path.join(folder, name));
    const mimeType = TYPES[path.extname(name).toLowerCase()];

    const started = Date.now();
    const result = await processResume(data, mimeType);
    const { text, parsed } = result;

    console.log(`\n${"─".repeat(60)}\n${name}`);
    console.log(
      `  способ: ${result.source} · разобрано на ${result.quality.score}% · ${Date.now() - started} мс`,
    );

    if (text.trim().length < 30) {
      unreadable += 1;
      console.log("  ТЕКСТ НЕ ИЗВЛЁКСЯ даже распознаванием");
      continue;
    }

    for (const field of FIELDS) {
      const value = parsed[field];
      const filled = Array.isArray(value) ? value.length > 0 : Boolean(value);
      if (filled) found[field] += 1;

      const shown = Array.isArray(value)
        ? value.length > 0
          ? `${value.length} шт.`
          : "—"
        : (value ?? "—");

      console.log(`  ${filled ? "+" : " "} ${LABELS[field]}: ${shown}`);
    }

    console.log(`    навыки: ${result.skills.join(", ") || "—"}`);
    console.log(`    стаж по датам: ${formatMonths(result.experienceMonths)}`);

    for (const item of parsed.experience) {
      console.log(
        `      · ${item.period ?? "период не найден"} | ${item.position ?? "должность не найдена"} | ${item.companyName}`,
      );
    }

    if (showText) {
      console.log(`\n--- текст ---\n${text}\n--- конец ---`);
    }
  }

  const readable = files.length - unreadable;

  console.log(`\n${"═".repeat(60)}`);
  console.log(`Файлов: ${files.length}, прочитано: ${readable}`);
  if (unreadable > 0) {
    console.log(`Не удалось извлечь текст: ${unreadable}`);
  }

  if (readable > 0) {
    console.log("\nНаходится в прочитанных файлах:");
    for (const field of FIELDS) {
      const share = Math.round((found[field] / readable) * 100);
      const bar = "█".repeat(Math.round(share / 5)).padEnd(20, "·");
      console.log(
        `  ${LABELS[field].padEnd(15)} ${bar} ${String(share).padStart(3)}%`,
      );
    }
  }
}

// Распознавание держит процесс открытым, поэтому закрываем его сами.
main().finally(shutdownOcr);
