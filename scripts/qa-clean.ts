import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { QA_COMPANY_NAME } from "./qa-seed";

// Удаляет тестовую компанию со всеми её данными.
// Запуск: npm run qa:clean

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const removed = await db.company.deleteMany({
    where: { name: QA_COMPANY_NAME },
  });
  console.log("Удалено тестовых компаний:", removed.count);
  console.log("Осталось компаний в базе:", await db.company.count());
}

main().finally(() => db.$disconnect());
