import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Небольшая проверка: подключаемся к базе и считаем записи в каждой таблице.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const counts = {
    "Компании": await db.company.count(),
    "Пользователи": await db.user.count(),
    "Этапы": await db.stage.count(),
    "Вакансии": await db.job.count(),
    "Кандидаты": await db.candidate.count(),
    "Резюме": await db.resume.count(),
    "Интервью": await db.interview.count(),
    "Фидбэки": await db.feedback.count(),
    "История": await db.candidateHistory.count(),
    "Ссылки «Поделиться»": await db.shareLink.count(),
    "Уведомления": await db.notification.count(),
    "Журнал действий": await db.auditLog.count(),
  };

  console.log("Подключение к базе данных работает.\n");
  for (const [name, count] of Object.entries(counts)) {
    console.log(`  ${name}: ${count} записей`);
  }
}

main()
  .catch((error) => {
    console.error("Ошибка подключения:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
