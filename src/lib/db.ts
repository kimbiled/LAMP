import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Единственная точка подключения к базе данных.
// Все остальные файлы проекта обращаются к базе только через db.

// Настройки пула соединений.
//
// База находится во Франкфурте, и установка защищённого соединения с ней
// занимает около полусекунды. Поэтому открытые соединения нужно держать
// и переиспользовать, а не открывать заново на каждый запрос.
function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 5, // страницы делают до пяти запросов одновременно
    idleTimeoutMillis: 5 * 60 * 1000,
    connectionTimeoutMillis: 15 * 1000,
    keepAlive: true,
  });

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Важно: клиент создаётся ТОЛЬКО если его ещё нет.
// В режиме разработки Next.js перезапускает код при каждом изменении файла.
// Если создавать пул соединений при каждом перезапуске, старые пулы
// остаются висеть, соединения к базе заканчиваются и страницы зависают.
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
