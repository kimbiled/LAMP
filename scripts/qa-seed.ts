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

  const users = await db.user.findMany({ where: { companyId: company.id } });
  const byEmail = (email: string) => users.find((user) => user.email === email)!;
  const admin = byEmail("qa-admin@example.com");
  const recruiter = byEmail("qa-recruiter@example.com");
  const manager = byEmail("qa-manager@example.com");

  const stages = await db.stage.findMany({
    where: { companyId: company.id },
    orderBy: { position: "asc" },
  });

  const job = await db.job.create({
    data: {
      companyId: company.id,
      title: "Frontend-разработчик",
      description: "Разработка интерфейсов внутренних сервисов.",
      requirements: "React, TypeScript, опыт от 3 лет.",
      salaryMin: 800_000,
      salaryMax: 1_200_000,
      recruiterId: recruiter.id,
      hiringManagerId: manager.id,
      createdById: admin.id,
    },
  });

  await db.job.create({
    data: {
      companyId: company.id,
      title: "Главный бухгалтер",
      recruiterId: admin.id,
      createdById: admin.id,
    },
  });

  const people = [
    { fullName: "Петров Иван Сергеевич", email: "ivan@mail.kz", position: "Frontend-разработчик", stage: 0 },
    { fullName: "Сидорова Мария Павловна", email: "maria@mail.kz", position: "React-разработчик", stage: 1 },
    { fullName: "Ким Алексей Викторович", email: "alexey@mail.kz", position: "Senior Frontend", stage: 4 },
    { fullName: "Жумабаева Айгуль Ерлановна", email: "aigul@mail.kz", position: "Team Lead", stage: 6 },
  ];

  for (const person of people) {
    const candidate = await db.candidate.create({
      data: {
        companyId: company.id,
        jobId: job.id,
        stageId: stages[person.stage].id,
        fullName: person.fullName,
        phone: "+7 701 123 45 67",
        email: person.email,
        city: "Астана",
        currentPosition: person.position,
        experienceYears: 5,
        salaryExpectation: 900_000,
        skills: ["React", "TypeScript"],
        languages: ["Русский — родной", "Английский — B2"],
        createdById: recruiter.id,
      },
    });

    await db.candidateHistory.create({
      data: {
        companyId: company.id,
        candidateId: candidate.id,
        type: "CANDIDATE_CREATED",
        toStageId: stages[person.stage].id,
        actorId: recruiter.id,
        actorName: recruiter.fullName,
      },
    });
  }

  console.log("Тестовая компания создана: 2 вакансии, 4 кандидата.");
  console.log("  qa-admin@example.com      — администратор");
  console.log("  qa-recruiter@example.com  — рекрутер");
  console.log("  qa-manager@example.com    — нанимающий менеджер");
  console.log(`  пароль у всех: ${QA_PASSWORD}`);
}

main().finally(() => db.$disconnect());
