import "dotenv/config";
import { rm } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Удаляет тестовую компанию со всеми её данными.
// Запуск: npm run qa:clean
//
// Название намеренно продублировано, а не импортировано из qa-seed.ts:
// импорт запускал бы скрипт создания и компания создавалась бы заново.

const QA_COMPANY_NAME = "QA Тест Компания";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const companies = await db.company.findMany({
    where: { name: QA_COMPANY_NAME },
    select: { id: true },
  });

  // Сначала убираем загруженные файлы, потом записи в базе.
  for (const company of companies) {
    await rm(path.join(process.cwd(), "storage", company.id), {
      recursive: true,
      force: true,
    });
  }

  const removed = await db.company.deleteMany({
    where: { name: QA_COMPANY_NAME },
  });
  console.log("Удалено тестовых компаний:", removed.count);
  console.log("Осталось компаний в базе:", await db.company.count());
}

main().finally(() => db.$disconnect());
