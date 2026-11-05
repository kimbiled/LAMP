// Разовая диагностика: какие телефоны в базе повторяются у разных людей.
// Только чтение.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const all = await db.candidate.findMany({
    select: { id: true, fullName: true, phone: true, phoneKey: true },
    orderBy: { createdAt: "desc" },
  });

  const byKey = new Map<string, { fullName: string; phone: string | null }[]>();
  for (const c of all) {
    if (!c.phoneKey) continue;
    const list = byKey.get(c.phoneKey) ?? [];
    list.push({ fullName: c.fullName, phone: c.phone });
    byKey.set(c.phoneKey, list);
  }

  const shared = [...byKey.entries()]
    .filter(([, list]) => list.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`Всего кандидатов: ${all.length}`);
  console.log(`Без телефона: ${all.filter((c) => !c.phoneKey).length}`);
  console.log(`Телефонов, которые делят несколько человек: ${shared.length}\n`);

  for (const [key, list] of shared.slice(0, 8)) {
    console.log(`Ключ ${key} — ${list.length} человек:`);
    for (const c of list) {
      console.log(`    ${c.fullName}  (в карточке: ${c.phone ?? "пусто"})`);
    }
    console.log();
  }

  await db.$disconnect();
}

main();
