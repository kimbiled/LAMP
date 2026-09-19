import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Единственная точка подключения к базе данных.
// Все остальные файлы проекта обращаются к базе только через db.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// В режиме разработки Next.js перезапускает код при каждом изменении файла.
// Без этой строки каждый перезапуск открывал бы новое соединение с базой.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
