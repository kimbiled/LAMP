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
  // true — второго человека не заводили: телефон или почта совпали
  // с уже существующей карточкой, и новое резюме легло в неё.
  existing: boolean;
  fullName: string;
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

  // Дублей не заводим. Если телефон или почта из резюме уже есть
  // у кандидата этой компании — это тот же человек: новый файл
  // становится его текущим резюме, а данные карточки не трогаем
  // (их мог поправить рекрутер). Раньше заводилась вторая карточка,
  // и история человека расползалась на две.
  if (duplicates.length > 0) {
    const target = duplicates[0];
    await db.resume.updateMany({
      where: { candidateId: target.id },
      data: { isCurrent: false },
    });
    await db.resume.create({
      data: {
        companyId: params.companyId,
        candidateId: target.id,
        fileName: params.file.fileName,
        storageKey,
        mimeType: params.file.mimeType,
        sizeBytes: params.file.data.length,
        parsedText: text.slice(0, 100_000),
        textSource: params.processed.source,
        parseScore: params.processed.quality.score,
        uploadedById: params.actorId,
      },
    });

    const current = await db.candidate.findUnique({
      where: { id: target.id },
      select: { photoKey: true, sourceUrl: true },
    });
    const update: { photoKey?: string; sourceUrl?: string } = {};
    if (!current?.photoKey && params.processed.photo) {
      update.photoKey = await saveFile({
        companyId: params.companyId,
        data: params.processed.photo.data,
        extension: params.processed.photo.extension,
        mimeType: params.processed.photo.mimeType,
      });
    }
    // Запоминаем ссылку на hh: при следующем импорте человек
    // узнается сразу, ещё до разбора файла.
    if (!current?.sourceUrl && params.source.url) {
      update.sourceUrl = params.source.url;
    }
    if (Object.keys(update).length > 0) {
      await db.candidate.update({ where: { id: target.id }, data: update });
    }

    await addHistory({
      companyId: params.companyId,
      candidateId: target.id,
      type: "RESUME_UPLOADED",
      comment: `${params.file.fileName} — повторно, новая карточка не создавалась`,
      actorId: params.actorId,
      actorName: params.actorName,
    });

    return {
      candidateId: target.id,
      existing: true,
      fullName: target.fullName,
      duplicates,
    };
  }

  // Фотография лежит отдельным файлом: так её можно отдать в карточке
  // и в списках, не читая каждый раз всё резюме.
  const photoKey = params.processed.photo
    ? await saveFile({
        companyId: params.companyId,
        data: params.processed.photo.data,
        extension: params.processed.photo.extension,
        mimeType: params.processed.photo.mimeType,
      })
    : null;

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
      photoKey,
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

  return {
    candidateId: candidate.id,
    existing: false,
    fullName: parsed.fullName ?? params.file.fileName,
    duplicates,
  };
}
