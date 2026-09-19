import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_STAGES } from "../src/lib/stages";

// Служебный скрипт для проверки работы системы.
// Создаёт отдельную тестовую компанию с тремя сотрудниками —
// на ней удобно проверять роли, права и изоляцию данных,
// не трогая вашу настоящую компанию.
//
// Запуск:  npm run qa:seed
// Удалить: npm run qa:clean

export const QA_COMPANY_NAME = "QA Тест Компания";
const QA_PASSWORD = "qa-password-123";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function hash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

async function main() {
  await db.company.deleteMany({ where: { name: QA_COMPANY_NAME } });

  const company = await db.company.create({ data: { name: QA_COMPANY_NAME } });
  const passwordHash = hash(QA_PASSWORD);

  await db.user.createMany({
    data: [
      {
        companyId: company.id,
        email: "qa-admin@example.com",
        fullName: "Анна Админова",
        passwordHash,
        role: "ADMIN",
      },
      {
        companyId: company.id,
        email: "qa-recruiter@example.com",
        fullName: "Роман Рекрутов",
        passwordHash,
        role: "RECRUITER",
      },
      {
        companyId: company.id,
        email: "qa-manager@example.com",
        fullName: "Максим Менеджеров",
        passwordHash,
        role: "HIRING_MANAGER",
      },
    ],
  });

  await db.stage.createMany({
    data: DEFAULT_STAGES.map((stage, index) => ({
      companyId: company.id,
      name: stage.name,
      key: stage.key,
      position: index + 1,
    })),
  });

  console.log("Тестовая компания создана.");
  console.log("  qa-admin@example.com      — администратор");
  console.log("  qa-recruiter@example.com  — рекрутер");
  console.log("  qa-manager@example.com    — нанимающий менеджер");
  console.log(`  пароль у всех: ${QA_PASSWORD}`);
}

main().finally(() => db.$disconnect());
