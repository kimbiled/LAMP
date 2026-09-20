import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseResume } from "../src/lib/resume/parse";

// Разовая доработка: заполняет опыт работы и образование у кандидатов,
// чьё резюме было загружено до улучшений разборщика.
// Ничего не перезаписывает — трогает только пустые места.
//
// Запуск: npx tsx scripts/backfill-resume-data.ts

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const candidates = await db.candidate.findMany({
    where: { experience: { none: {} }, resumes: { some: {} } },
    include: {
      resumes: { orderBy: { uploadedAt: "desc" }, take: 1 },
      _count: { select: { education: true } },
    },
  });

  console.log("кандидатов без опыта с загруженным резюме:", candidates.length);

  for (const candidate of candidates) {
    const text = candidate.resumes[0]?.parsedText ?? "";
    const parsed = parseResume(text);

    if (parsed.experience.length === 0) {
      console.log(`  ${candidate.fullName}: распознать не удалось, пропускаю`);
      continue;
    }

    await db.candidate.update({
      where: { id: candidate.id },
      data: {
        currentPosition: candidate.currentPosition ?? parsed.currentPosition,
        birthDate:
          candidate.birthDate ??
          (parsed.birthDate ? new Date(parsed.birthDate) : null),
        experience: {
          create: parsed.experience.map((item, index) => ({
            companyName: item.companyName,
            position: item.position,
            period: item.period,
            description: item.description,
            sortOrder: index,
          })),
        },
        ...(candidate._count.education === 0
          ? {
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

    console.log(
      `  ${candidate.fullName}: добавлено мест работы — ${parsed.experience.length}`,
    );
  }
}

main().finally(() => db.$disconnect());
