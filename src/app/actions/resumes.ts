"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { candidateVisibilityFilter, jobVisibilityFilter } from "@/lib/permissions";
import {
  MAX_FILE_BYTES,
  extensionFor,
  loadFile,
  removeFile,
  saveFile,
} from "@/lib/storage";
import { extractText } from "@/lib/resume/extract-text";
import { parseResume } from "@/lib/resume/parse";
import { addHistory } from "@/lib/history";

export type ResumeFormState = {
  formError?: string;
  success?: string;
};

type PreparedFile = {
  data: Buffer;
  fileName: string;
  mimeType: string;
  extension: string;
};

// Проверяем файл до того, как что-либо сохранять.
async function prepareFile(
  formData: FormData,
): Promise<PreparedFile | { error: string }> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Выберите файл резюме" };
  }

  if (file.size > MAX_FILE_BYTES) {
    return { error: "Файл больше 10 МБ. Попробуйте сжать или сохранить заново" };
  }

  // Браузер не всегда правильно определяет тип файла,
  // поэтому дополнительно смотрим на расширение имени.
  let mimeType = file.type;
  if (!extensionFor(mimeType)) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf")) {
      mimeType = "application/pdf";
    } else if (lower.endsWith(".docx")) {
      mimeType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
  }

  const extension = extensionFor(mimeType);
  if (!extension) {
    return { error: "Поддерживаются только файлы PDF и DOCX" };
  }

  return {
    data: Buffer.from(await file.arrayBuffer()),
    fileName: file.name.slice(0, 200),
    mimeType,
    extension,
  };
}

export async function createCandidateFromResume(
  _prevState: ResumeFormState,
  formData: FormData,
): Promise<ResumeFormState> {
  const scope = await getScope();

  if (!scope.can("candidates.create")) {
    return { formError: "Недостаточно прав для добавления кандидатов" };
  }

  const prepared = await prepareFile(formData);
  if ("error" in prepared) {
    return { formError: prepared.error };
  }

  const text = await extractText(prepared.data, prepared.mimeType);

  if (text.trim().length < 30) {
    return {
      formError:
        "Не удалось прочитать текст из файла. Возможно, резюме — это скан или картинка. Добавьте кандидата вручную",
    };
  }

  const parsed = parseResume(text);

  const stage = await db.stage.findFirst({
    where: { companyId: scope.companyId },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  if (!stage) {
    return { formError: "В компании не настроены этапы подбора" };
  }

  const rawJobId = formData.get("jobId");
  const jobId =
    typeof rawJobId === "string" && rawJobId !== ""
      ? (
          await db.job.findFirst({
            where: {
              id: rawJobId,
              companyId: scope.companyId,
              ...jobVisibilityFilter(scope.session.user),
            },
            select: { id: true },
          })
        )?.id ?? null
      : null;

  const storageKey = await saveFile({
    companyId: scope.companyId,
    data: prepared.data,
    extension: prepared.extension,
    mimeType: prepared.mimeType,
  });

  const candidate = await db.candidate.create({
    data: {
      companyId: scope.companyId,
      jobId,
      stageId: stage.id,
      // Если ФИО распознать не удалось, подставляем имя файла:
      // рекрутер увидит это и исправит.
      fullName: parsed.fullName ?? prepared.fileName.replace(/\.[^.]+$/, ""),
      phone: parsed.phone,
      email: parsed.email,
      city: parsed.city,
      currentPosition: parsed.currentPosition,
      experienceYears: parsed.experienceYears,
      salaryExpectation: parsed.salaryExpectation,
      currency: parsed.currency ?? "KZT",
      telegram: parsed.telegram,
      skills: parsed.skills,
      languages: parsed.languages,
      source: "Резюме",
      createdById: scope.session.user.id,
      experience: {
        create: parsed.experience.map((item, index) => ({
          companyName: item.companyName,
          position: item.position,
          period: item.period,
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
          companyId: scope.companyId,
          fileName: prepared.fileName,
          storageKey,
          mimeType: prepared.mimeType,
          sizeBytes: prepared.data.length,
          parsedText: text.slice(0, 100_000),
          uploadedById: scope.session.user.id,
        },
      },
    },
  });

  await addHistory({
    companyId: scope.companyId,
    candidateId: candidate.id,
    type: "CANDIDATE_CREATED",
    toStageId: stage.id,
    comment: "Из загруженного резюме",
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
  });

  redirect(`/candidates/${candidate.id}/edit?parsed=1`);
}

export async function attachResume(
  candidateId: string,
  _prevState: ResumeFormState,
  formData: FormData,
): Promise<ResumeFormState> {
  const scope = await getScope();

  if (!scope.can("candidates.edit")) {
    return { formError: "Недостаточно прав для загрузки резюме" };
  }

  const candidate = await db.candidate.findFirst({
    where: {
      id: candidateId,
      companyId: scope.companyId,
      ...candidateVisibilityFilter(scope.session.user),
    },
    select: { id: true },
  });

  if (!candidate) {
    return { formError: "Кандидат не найден" };
  }

  const prepared = await prepareFile(formData);
  if ("error" in prepared) {
    return { formError: prepared.error };
  }

  const text = await extractText(prepared.data, prepared.mimeType);

  const storageKey = await saveFile({
    companyId: scope.companyId,
    data: prepared.data,
    extension: prepared.extension,
    mimeType: prepared.mimeType,
  });

  // Прошлые резюме остаются в истории, текущим становится новое.
  await db.resume.updateMany({
    where: { candidateId: candidate.id },
    data: { isCurrent: false },
  });

  await db.resume.create({
    data: {
      companyId: scope.companyId,
      candidateId: candidate.id,
      fileName: prepared.fileName,
      storageKey,
      mimeType: prepared.mimeType,
      sizeBytes: prepared.data.length,
      parsedText: text.slice(0, 100_000),
      uploadedById: scope.session.user.id,
    },
  });

  await addHistory({
    companyId: scope.companyId,
    candidateId: candidate.id,
    type: "RESUME_UPLOADED",
    comment: prepared.fileName,
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
  });

  revalidatePath(`/candidates/${candidate.id}`);

  return { success: "Резюме загружено" };
}

export async function deleteResume(formData: FormData): Promise<void> {
  const scope = await getScope();
  if (!scope.can("candidates.edit")) {
    return;
  }

  const resumeId = formData.get("resumeId");
  if (typeof resumeId !== "string") return;

  const resume = await db.resume.findFirst({
    where: { id: resumeId, companyId: scope.companyId },
  });

  if (!resume) return;

  await db.resume.delete({ where: { id: resume.id } });
  await removeFile(resume.storageKey);

  // Если удалили текущее резюме, текущим становится предыдущее.
  const previous = await db.resume.findFirst({
    where: { candidateId: resume.candidateId },
    orderBy: { uploadedAt: "desc" },
  });

  if (previous) {
    await db.resume.update({
      where: { id: previous.id },
      data: { isCurrent: true },
    });
  }

  revalidatePath(`/candidates/${resume.candidateId}`);
}

// Повторное распознавание уже загруженного резюме.
// Нужно, когда разборщик стал умнее: файл перезагружать не требуется.
export async function reparseResume(formData: FormData): Promise<void> {
  const scope = await getScope();

  if (!scope.can("candidates.edit")) {
    return;
  }

  const candidateId = formData.get("candidateId");
  if (typeof candidateId !== "string") return;

  const candidate = await db.candidate.findFirst({
    where: {
      id: candidateId,
      companyId: scope.companyId,
      ...candidateVisibilityFilter(scope.session.user),
    },
    include: {
      resumes: { where: { isCurrent: true }, orderBy: { uploadedAt: "desc" }, take: 1 },
    },
  });

  const resume = candidate?.resumes[0];
  if (!candidate || !resume) return;

  // Текст сохраняется при загрузке. Если его почему-то нет — читаем файл.
  let text = resume.parsedText ?? "";
  if (text.trim().length < 30) {
    const data = await loadFile(resume.storageKey);
    text = await extractText(data, resume.mimeType);
    await db.resume.update({
      where: { id: resume.id },
      data: { parsedText: text.slice(0, 100_000) },
    });
  }

  const parsed = parseResume(text);

  // Опыт и образование заменяем целиком: это результат разбора файла.
  await db.candidateExperience.deleteMany({ where: { candidateId: candidate.id } });
  await db.candidateEducation.deleteMany({ where: { candidateId: candidate.id } });

  // Остальные поля трогаем, только если рекрутер их ещё не заполнил.
  await db.candidate.update({
    where: { id: candidate.id },
    data: {
      phone: candidate.phone ?? parsed.phone,
      email: candidate.email ?? parsed.email,
      city: candidate.city ?? parsed.city,
      currentPosition: candidate.currentPosition ?? parsed.currentPosition,
      experienceYears: candidate.experienceYears ?? parsed.experienceYears,
      salaryExpectation: candidate.salaryExpectation ?? parsed.salaryExpectation,
      telegram: candidate.telegram ?? parsed.telegram,
      skills: candidate.skills.length > 0 ? candidate.skills : parsed.skills,
      languages:
        candidate.languages.length > 0 ? candidate.languages : parsed.languages,
      experience: {
        create: parsed.experience.map((item, index) => ({
          companyName: item.companyName,
          position: item.position,
          period: item.period,
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
    },
  });

  await addHistory({
    companyId: scope.companyId,
    candidateId: candidate.id,
    type: "CANDIDATE_UPDATED",
    comment: `Повторное распознавание резюме: мест работы — ${parsed.experience.length}`,
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
  });

  revalidatePath(`/candidates/${candidate.id}`);
}
