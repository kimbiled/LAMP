import { db } from "./db";
import { saveFile } from "./storage";
import { addHistory } from "./history";
import { findDuplicates } from "./duplicates";
import { phoneKey } from "./contacts";
import type { ProcessedResume } from "./resume/pipeline";

// Создание кандидата из уже разобранного резюме.
//
// Один и тот же путь для двух входов: форма загрузки в интерфейсе
// и точка приёма для расширения Chrome. Раньше это был один кусок
// внутри серверного действия; когда появился второй вход, копия
// неизбежно начала бы отставать — поэтому вынесено сюда.
//
// Разбор файла сюда не входит: наверху уже знают, что получилось,
// и могут отказаться заводить карточку (например, если текст пустой).

export type CandidateSource = {
  // Как подписать источник в карточке: «Резюме», «hh.kz».
  label: string;
  // Ссылка на исходное объявление, если она есть.
  url?: string | null;
};

export type CreatedCandidate = {
  candidateId: string;
  // Похожие люди, уже заведённые в этой компании. Карточку всё равно
  // создаём: файл уже загружен, и терять его из-за подозрения нельзя.
  // Наверху решают, как об этом предупредить.
  duplicates: Awaited<ReturnType<typeof findDuplicates>>;
};

export async function createCandidateFromResume(params: {
  companyId: string;
  actorId: string;
  actorName: string;
  jobId: string | null;
  file: { data: Buffer; fileName: string; mimeType: string; extension: string };
  processed: ProcessedResume;
  source: CandidateSource;
}): Promise<CreatedCandidate | { error: string }> {
  const { parsed, text } = params.processed;

  const stage = await db.stage.findFirst({
    where: { companyId: params.companyId },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  if (!stage) {
    return { error: "В компании не настроены этапы подбора" };
  }

  const duplicates = await findDuplicates({
    companyId: params.companyId,
    phone: parsed.phone,
    email: parsed.email,
  });

  const storageKey = await saveFile({
    companyId: params.companyId,
    data: params.file.data,
    extension: params.file.extension,
    mimeType: params.file.mimeType,
  });

  const candidate = await db.candidate.create({
    data: {
      companyId: params.companyId,
      jobId: params.jobId,
      stageId: stage.id,
      // Если ФИО распознать не удалось, подставляем имя файла:
      // рекрутер увидит это и исправит.
      fullName: parsed.fullName ?? params.file.fileName.replace(/\.[^.]+$/, ""),
      phone: parsed.phone,
      phoneKey: phoneKey(parsed.phone),
      email: parsed.email,
      city: parsed.city,
      birthDate: parsed.birthDate ? new Date(parsed.birthDate) : null,
      currentPosition: parsed.currentPosition,
      experienceYears: parsed.experienceYears,
      experienceMonths: params.processed.experienceMonths,
      salaryExpectation: parsed.salaryExpectation,
      currency: parsed.currency ?? "KZT",
      telegram: parsed.telegram,
      skills: parsed.skills,
      languages: parsed.languages,
      source: params.source.label,
      sourceUrl: params.source.url ?? null,
      createdById: params.actorId,
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
      resumes: {
        create: {
          companyId: params.companyId,
          fileName: params.file.fileName,
          storageKey,
          mimeType: params.file.mimeType,
          sizeBytes: params.file.data.length,
          parsedText: text.slice(0, 100_000),
          textSource: params.processed.source,
          parseScore: params.processed.quality.score,
          uploadedById: params.actorId,
        },
      },
    },
    select: { id: true },
  });

  await addHistory({
    companyId: params.companyId,
    candidateId: candidate.id,
    type: "CANDIDATE_CREATED",
    toStageId: stage.id,
    comment:
      params.source.label === "Резюме"
        ? "Из загруженного резюме"
        : `Из источника: ${params.source.label}`,
    actorId: params.actorId,
    actorName: params.actorName,
  });

  return { candidateId: candidate.id, duplicates };
}
