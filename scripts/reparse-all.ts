import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { processResume } from "../src/lib/resume/pipeline";
import { shutdownOcr } from "../src/lib/resume/ocr";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { phoneKey } from "../src/lib/contacts";

// Файл читаем напрямую, а не через src/lib/storage: тот помечен
// как серверный и из обычного скрипта не запускается. Путь тот же —
// папка storage рядом с проектом, внутри каталог компании.
const ROOT = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(process.cwd(), "storage");

const readStored = (key: string) => readFile(path.join(ROOT, key));

// Перечитать резюме всех кандидатов заново.
//
// Нужно после доработок разборщика: карточки, заведённые раньше,
// хранят результат старой версии. Файлы читаются заново, поэтому
// подхватываются и улучшения чтения PDF, и распознавание сканов.
//
// По умолчанию заполняются только пустые поля — то, что рекрутер
// правил руками, остаётся нетронутым. Опыт и образование заменяются,
// только если их нет вовсе.
//
// Запуск:
//   npx tsx scripts/reparse-all.ts
//   npx tsx scripts/reparse-all.ts --force   заменить опыт и образование
//                                            даже там, где они уже есть

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const force = process.argv.includes("--force");

  const candidates = await db.candidate.findMany({
    where: { resumes: { some: {} } },
    include: {
      resumes: {
        where: { isCurrent: true },
        orderBy: { uploadedAt: "desc" },
        take: 1,
      },
      _count: { select: { experience: true, education: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`кандидатов с резюме: ${candidates.length}`);
  if (force) console.log("режим --force: опыт и образование будут заменены\n");

  let improved = 0;

  for (const candidate of candidates) {
    const resume = candidate.resumes[0];
    if (!resume) continue;

    let processed;
    try {
      const data = await readStored(resume.storageKey);
      processed = await processResume(data, resume.mimeType);
    } catch {
      console.log(`  ${candidate.fullName}: файл не читается, пропускаю`);
      continue;
    }

    const parsed = processed.parsed;
    const replaceLists = force || candidate._count.experience === 0;

    const gained: string[] = [];
    if (!candidate.phone && parsed.phone) gained.push("телефон");
    if (!candidate.email && parsed.email) gained.push("почта");
    if (!candidate.city && parsed.city) gained.push("город");
    if (!candidate.birthDate && parsed.birthDate) gained.push("дата рождения");
    if (!candidate.currentPosition && parsed.currentPosition) {
      gained.push("должность");
    }
    if (replaceLists && parsed.experience.length > 0) {
      gained.push(`опыт (${parsed.experience.length})`);
    }

    if (replaceLists) {
      await db.candidateExperience.deleteMany({
        where: { candidateId: candidate.id },
      });
      await db.candidateEducation.deleteMany({
        where: { candidateId: candidate.id },
      });
    }

    await db.candidate.update({
      where: { id: candidate.id },
      data: {
        phone: candidate.phone ?? parsed.phone,
        phoneKey: candidate.phoneKey ?? phoneKey(parsed.phone),
        email: candidate.email ?? parsed.email,
        city: candidate.city ?? parsed.city,
        birthDate:
          candidate.birthDate ??
          (parsed.birthDate ? new Date(parsed.birthDate) : null),
        currentPosition: candidate.currentPosition ?? parsed.currentPosition,
        experienceYears: candidate.experienceYears ?? parsed.experienceYears,
        experienceMonths: processed.experienceMonths,
        // Навыки объединяем: найденные словарём плюс уже стоявшие в карточке.
        skills: Array.from(new Set([...candidate.skills, ...processed.skills])),
        ...(replaceLists
          ? {
              experience: {
                create: parsed.experience.map((item, index) => ({
                  companyName: item.companyName,
                  position: item.position,
                  period: item.period,
                  description: item.description,
                  sortOrder: index,
                })),
              },
              education: {
                create: parsed.education.map((item, index) => ({
                  institution: item.institution,
                  specialty: item.specialty,
                  years: item.years,
                  sortOrder: index,
                })),
              },
            }
          : {}),
      },
    });

    await db.resume.update({
      where: { id: resume.id },
      data: {
        parsedText: processed.text.slice(0, 100_000),
        textSource: processed.source,
        parseScore: processed.quality.score,
      },
    });

    if (gained.length > 0) improved += 1;

    console.log(
      `  ${candidate.fullName.slice(0, 28).padEnd(30)} ${String(processed.quality.score).padStart(3)}%  ` +
        (gained.length > 0 ? `+ ${gained.join(", ")}` : "без изменений"),
    );
  }

  console.log(`\nГотово. Стало полнее у ${improved} из ${candidates.length}.`);
}

main()
  .finally(shutdownOcr)
  .finally(() => db.$disconnect());
