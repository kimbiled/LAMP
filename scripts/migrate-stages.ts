import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_STAGES } from "../src/lib/stages";
import type { StageKey } from "../src/generated/prisma/enums";

// Разовый перенос компаний на новый набор этапов.
//
// Старые этапы переименовываются в новые там, где смысл совпадает,
// недостающие добавляются, лишние удаляются — но только после того,
// как их кандидаты переедут на подходящий этап.
//
// Запуск: npx tsx scripts/migrate-stages.ts

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Старый ключ → новый ключ. Кандидаты с этих этапов переедут.
const MOVE: Partial<Record<string, StageKey>> = {
  INTERVIEW_SCHEDULED: "SCREENING",
  INTERVIEW_DONE: "TECH_INTERVIEW",
  HIRED: "OFFER",
  REJECTED: "WE_DECLINED",
};

async function main() {
  const companies = await db.company.findMany({ select: { id: true, name: true } });

  for (const company of companies) {
    console.log(`\nКомпания «${company.name}»`);

    const existing = await db.stage.findMany({
      where: { companyId: company.id },
      include: { _count: { select: { candidates: true } } },
    });

    // 1. Создаём или обновляем этапы из нового набора.
    const byKey = new Map(existing.map((stage) => [stage.key, stage]));

    for (const [index, wanted] of DEFAULT_STAGES.entries()) {
      const found = byKey.get(wanted.key);

      if (found) {
        if (found.name !== wanted.name || found.position !== index + 1) {
          await db.stage.update({
            where: { id: found.id },
            data: { name: wanted.name, position: index + 1 },
          });
          console.log(`  переименован: «${found.name}» → «${wanted.name}»`);
        }
      } else {
        await db.stage.create({
          data: {
            companyId: company.id,
            name: wanted.name,
            key: wanted.key,
            position: index + 1,
          },
        });
        console.log(`  добавлен: «${wanted.name}»`);
      }
    }

    // 2. Лишние этапы: переселяем кандидатов и удаляем.
    const fresh = await db.stage.findMany({
      where: { companyId: company.id },
      include: { _count: { select: { candidates: true } } },
    });

    const wantedKeys = new Set<string>(DEFAULT_STAGES.map((s) => s.key));

    for (const stage of fresh) {
      if (!stage.key || wantedKeys.has(stage.key)) continue;

      const targetKey = MOVE[stage.key] ?? "NEW";
      const target = fresh.find((s) => s.key === targetKey);
      if (!target) continue;

      if (stage._count.candidates > 0) {
        await db.candidate.updateMany({
          where: { stageId: stage.id },
          data: { stageId: target.id },
        });
        console.log(
          `  перенесено кандидатов с «${stage.name}» на «${target.name}»: ${stage._count.candidates}`,
        );
      }

      await db.stage.delete({ where: { id: stage.id } });
      console.log(`  удалён лишний этап: «${stage.name}»`);
    }
  }

  console.log("\nГотово.");
}

main().finally(() => db.$disconnect());
