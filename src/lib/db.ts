import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Единственная точка подключения к базе данных.
// Все остальные файлы проекта обращаются к базе только через db.

// Настройки пула соединений.
//
// База находится во Франкфурте, и установка защищённого соединения с ней
// занимает около полусекунды. Поэтому открытые соединения нужно держать
// и переиспользовать, а не открывать заново на каждый запрос:
//   max — сколько соединений держать одновременно (страницы делают
//         до пяти запросов сразу);
//   idleTimeoutMillis — как долго держать незанятое соединение;
//   keepAlive — не давать сети «усыпить» соединение в паузах.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 8,
  idleTimeoutMillis: 5 * 60 * 1000,
  connectionTimeoutMillis: 15 * 1000,
  keepAlive: true,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// В режиме разработки Next.js перезапускает код при каждом изменении файла.
// Без этой строки каждый перезапуск открывал бы новое соединение с базой.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
