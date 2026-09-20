import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Назначение владельца системы — того, кто видит все компании сразу.
//
// Запуск:
//   npm run grant-owner -- почта@пример.kz
//   npm run grant-owner -- почта@пример.kz --revoke
//
// Через интерфейс первый владелец появиться не может специально:
// иначе любой администратор компании мог бы выдать себе доступ
// ко всем остальным компаниям.

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const email = args.find((arg) => !arg.startsWith("--"))?.toLowerCase();

  if (!email) {
    console.log("Укажите почту: npm run grant-owner -- почта@пример.kz");
    console.log("Чтобы снять права, добавьте --revoke");

    const owners = await db.user.findMany({
      where: { isSuperAdmin: true },
      select: {
        email: true,
        fullName: true,
        company: { select: { name: true } },
      },
    });

    if (owners.length > 0) {
      console.log("\nСейчас владельцы системы:");
      for (const owner of owners) {
        console.log(
          `  ${owner.email} — ${owner.fullName}, ${owner.company.name}`,
        );
      }
    } else {
      console.log("\nВладельцев системы пока нет.");
    }
    return;
  }

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      fullName: true,
      isSuperAdmin: true,
      company: { select: { name: true } },
    },
  });

  if (!user) {
    console.log(`Пользователь с почтой ${email} не найден.`);
    return;
  }

  if (user.isSuperAdmin === !revoke) {
    console.log(
      revoke
        ? `У ${user.fullName} и так нет прав владельца.`
        : `${user.fullName} уже владелец системы.`,
    );
    return;
  }

  await db.user.update({
    where: { id: user.id },
    data: { isSuperAdmin: !revoke },
  });

  console.log(
    revoke
      ? `Права владельца сняты: ${user.fullName} (${email}).`
      : `${user.fullName} (${email}, ${user.company.name}) — теперь владелец системы.`,
  );
  console.log(
    "Обновите страницу в браузере: в меню появится раздел «Система».",
  );
}

main().finally(() => db.$disconnect());
