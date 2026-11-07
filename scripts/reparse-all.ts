import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { processResume } from "../src/lib/resume/pipeline";
import { shutdownOcr } from "../src/lib/resume/ocr";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { phoneKey } from "../src/lib/contacts";

// Файл читаем напрямую, а не через src/lib/storage: тот помечен
// как серверный и из обычного скрипта не запускается. Путь тот же —
// папка storage рядом с проектом, внутри каталог компании.
const ROOT = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(process.cwd(), "storage");

const readStored = (key: string) => readFile(path.join(ROOT, key));

// Запись фото — тем же способом и с тем же видом ключа, что и saveFile.
async function writeStored(companyId: string, data: Buffer, ext: string) {
  const key = `${companyId}/${randomBytes(16).toString("hex")}.${ext}`;
  const full = path.join(ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return key;
}

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
//   npx tsx scripts/reparse-all.ts --force      заменить опыт и образование
//                                               даже там, где они уже есть
//   npx tsx scripts/reparse-all.ts --education  заменить только образование,
//                                               опыт работы не трогать
//   ... --dry-run   ничего не записывать, только показать, что изменится
//
// Внимание: --education и --force затирают образование, поправленное
// руками. Поэтому сначала запускайте с --dry-run и смотрите список.

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const force = process.argv.includes("--force");
  const educationOnly = process.argv.includes("--education");
  const dryRun = process.argv.includes("--dry-run");

  const candidates = await db.candidate.findMany({
    where: { resumes: { some: {} } },
    include: {
      resumes: {
        where: { isCurrent: true },
        orderBy: { uploadedAt: "desc" },
        take: 1,
      },
      _count: { select: { experience: true, education: true } },
      education: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`кандидатов с резюме: ${candidates.length}`);
  if (force) console.log("режим --force: опыт и образование будут заменены\n");
  if (educationOnly) console.log("режим --education: заменяется только образование\n");
  if (dryRun) console.log("пробный запуск: в базу ничего не пишется\n");

  // Перед заменой сохраняем старое образование в файл: если в нём были
  // ручные правки, их можно будет вернуть.
  if (!dryRun && (force || educationOnly)) {
    const backupDir = path.join(ROOT, "backups");
    await mkdir(backupDir, { recursive: true });
    const backupFile = path.join(
      backupDir,
      `education-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    await writeFile(
      backupFile,
      JSON.stringify(
        candidates.map((candidate) => ({
          candidateId: candidate.id,
          fullName: candidate.fullName,
          education: candidate.education.map((item) => ({
            institution: item.institution,
            specialty: item.specialty,
            years: item.years,
            sortOrder: item.sortOrder,
          })),
        })),
        null,
        2,
      ),
    );
    console.log(`резервная копия образования: ${backupFile}\n`);
  }

  let improved = 0;
  let photosFound = 0;
  let educationChanged = 0;

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

    const newPhoto = !candidate.photoKey && processed.photo !== null;
    if (newPhoto) photosFound += 1;

    const replaceLists = force || candidate._count.experience === 0;
    const replaceEducation = replaceLists || educationOnly;

    const describe = (items: { institution: string; specialty: string | null; years: string | null }[]) =>
      items.length === 0
        ? "—"
        : items
            .map((item) => [item.years, item.institution, item.specialty].filter(Boolean).join(" · "))
            .join(" | ");
    const oldEducation = describe(candidate.education);
    const newEducation = describe(parsed.education);
    const educationDiffers = replaceEducation && oldEducation !== newEducation;
    if (educationDiffers) educationChanged += 1;

    if (dryRun) {
      const notes: string[] = [];
      if (newPhoto) notes.push("+ фото");
      if (educationDiffers) {
        notes.push(`образование:\n      было:  ${oldEducation}\n      станет: ${newEducation}`);
      }
      if (notes.length > 0) {
        console.log(`  ${candidate.fullName.slice(0, 40)}  ${notes.join("  ")}`);
      }
      continue;
    }

    // Фото ставим только тем, у кого его ещё нет.
    const photoKey =
      candidate.photoKey ??
      (processed.photo
        ? await writeStored(
            candidate.companyId,
            processed.photo.data,
            processed.photo.extension,
          )
        : null);

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
    }
    if (replaceEducation) {
      await db.candidateEducation.deleteMany({
        where: { candidateId: candidate.id },
      });
    }
    if (educationDiffers) gained.push("образование");
    if (newPhoto) gained.push("фото");

    await db.candidate.update({
      where: { id: candidate.id },
      data: {
        phone: candidate.phone ?? parsed.phone,
        phoneKey: candidate.phoneKey ?? phoneKey(parsed.phone),
        email: candidate.email ?? parsed.email,
        city: candidate.city ?? parsed.city,
        photoKey,
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
            }
          : {}),
        ...(replaceEducation
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

  console.log(
    `\n${dryRun ? "Пробный запуск" : "Готово"}. ` +
      `Фото найдено у ${photosFound}, образование ${dryRun ? "изменится" : "изменилось"} у ${educationChanged}` +
      (dryRun ? "." : `, стало полнее у ${improved} из ${candidates.length}.`),
  );
}

main()
  .finally(shutdownOcr)
  .finally(() => db.$disconnect());
