import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Хранилище файлов резюме.
//
// Сейчас файлы лежат в папке storage на вашем компьютере.
// Когда будем публиковать LAMP в интернет, здесь появится второй вариант —
// облачное хранилище. Весь остальной код менять не придётся: он обращается
// только к этим четырём функциям.

const ROOT = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(process.cwd(), "storage");

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 МБ

export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

export function extensionFor(mimeType: string): string | null {
  return ALLOWED_TYPES[mimeType] ?? null;
}

// Имя файла на диске случайное: по нему нельзя угадать чужой файл,
// а исходное имя хранится отдельно, в базе.
export async function saveFile(params: {
  companyId: string;
  data: Buffer;
  extension: string;
}): Promise<string> {
  const name = `${randomBytes(16).toString("hex")}.${params.extension}`;
  const key = path.posix.join(params.companyId, name);
  const fullPath = path.join(ROOT, params.companyId, name);

  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, params.data);

  return key;
}

export async function loadFile(storageKey: string): Promise<Buffer> {
  return readFile(safePath(storageKey));
}

export async function removeFile(storageKey: string): Promise<void> {
  try {
    await unlink(safePath(storageKey));
  } catch {
    // Файла уже нет — это не ошибка.
  }
}

// Защита от подстановки пути вида «../../secret».
function safePath(storageKey: string): string {
  const fullPath = path.resolve(ROOT, storageKey);
  if (!fullPath.startsWith(path.resolve(ROOT) + path.sep)) {
    throw new Error("Некорректный путь к файлу");
  }
  return fullPath;
}
