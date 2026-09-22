import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Хранилище файлов резюме.
//
// Есть два режима, переключаются в файле .env:
//
//   STORAGE_DRIVER=local  — файлы лежат в папке storage на компьютере.
//                           Так удобно при разработке.
//   STORAGE_DRIVER=s3     — файлы лежат в облачном хранилище.
//                           Нужен после публикации в интернет: на многих
//                           хостингах диск очищается при каждом обновлении.
//
// Остальной код проекта об этом не знает — он вызывает только
// saveFile, loadFile и removeFile.

const DRIVER = process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";

const ROOT = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(process.cwd(), "storage");

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 МБ

export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  // Резюме присылают и простым текстом, и в старом формате RTF.
  "text/plain": "txt",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
  // Сканы и фотографии резюме: текст из них достаётся распознаванием.
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionFor(mimeType: string): string | null {
  return ALLOWED_TYPES[mimeType] ?? null;
}

// Имя файла случайное: по нему нельзя угадать чужой файл,
// а исходное имя хранится отдельно, в базе.
function buildKey(companyId: string, extension: string): string {
  return path.posix.join(
    companyId,
    `${randomBytes(16).toString("hex")}.${extension}`,
  );
}

export async function saveFile(params: {
  companyId: string;
  data: Buffer;
  extension: string;
  mimeType?: string;
}): Promise<string> {
  const key = buildKey(params.companyId, params.extension);

  if (DRIVER === "s3") {
    const { client, bucket } = s3();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: params.data,
        ContentType: params.mimeType,
      }),
    );

    return key;
  }

  const fullPath = path.join(ROOT, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, params.data);

  return key;
}

export async function loadFile(storageKey: string): Promise<Buffer> {
  if (DRIVER === "s3") {
    const { client, bucket } = s3();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");

    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
    );

    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error("Пустой ответ хранилища");
    }
    return Buffer.from(bytes);
  }

  return readFile(safePath(storageKey));
}

export async function removeFile(storageKey: string): Promise<void> {
  try {
    if (DRIVER === "s3") {
      const { client, bucket } = s3();
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }),
      );
      return;
    }

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

// Подключение к облачному хранилищу. Создаётся один раз при первом файле.
let s3Client: import("@aws-sdk/client-s3").S3Client | null = null;

function s3() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION ?? "auto";
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Для STORAGE_DRIVER=s3 нужно заполнить S3_BUCKET, S3_ACCESS_KEY_ID и S3_SECRET_ACCESS_KEY в файле .env",
    );
  }

  if (!s3Client) {
    // Загружаем библиотеку только в этом режиме, чтобы при локальной
    // работе она не занимала память.
    const { S3Client } =
      require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");

    s3Client = new S3Client({
      region,
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  return { client: s3Client, bucket };
}
