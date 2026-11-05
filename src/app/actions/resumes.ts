"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import {
  candidateVisibilityFilter,
  jobVisibilityFilter,
} from "@/lib/permissions";
import {
  MAX_FILE_BYTES,
  extensionFor,
  loadFile,
  removeFile,
  saveFile,
} from "@/lib/storage";
import { processResume } from "@/lib/resume/pipeline";
import { addHistory } from "@/lib/history";
// Общий путь создания карточки: им же пользуется точка приёма
// для расширения Chrome, чтобы поведение не разъезжалось.
import { createCandidateFromResume as createCandidate } from "@/lib/candidate-from-resume";

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
    return {
      error: "Файл больше 10 МБ. Попробуйте сжать или сохранить заново",
    };
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
    } else if (lower.endsWith(".txt")) {
      mimeType = "text/plain";
    } else if (lower.endsWith(".rtf")) {
      mimeType = "application/rtf";
    } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
      mimeType = "image/jpeg";
    } else if (lower.endsWith(".png")) {
      mimeType = "image/png";
    } else if (lower.endsWith(".webp")) {
      mimeType = "image/webp";
    }
  }

  const extension = extensionFor(mimeType);
  if (!extension) {
    return {
      error: "Поддерживаются PDF, DOCX, RTF, TXT и картинки JPG, PNG",
    };
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

  // Конвейер сам решит, читать текстовый слой или распознавать картинку.
  const processed = await processResume(prepared.data, prepared.mimeType);
  const { text } = processed;

  if (text.trim().length < 30) {
    return {
      formError:
        "Не удалось прочитать текст из файла. Возможно, страница снята слишком мелко или под углом. Попробуйте другой файл или добавьте кандидата вручную",
    };
  }

  const rawJobId = formData.get("jobId");
  const jobId =
    typeof rawJobId === "string" && rawJobId !== ""
      ? ((
          await db.job.findFirst({
            where: {
              id: rawJobId,
              companyId: scope.companyId,
              ...jobVisibilityFilter(scope.session.user),
            },
            select: { id: true },
          })
        )?.id ?? null)
      : null;

  const created = await createCandidate({
    companyId: scope.companyId,
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
    jobId,
    file: prepared,
    processed,
    source: { label: "Резюме" },
  });

  if ("error" in created) {
    return { formError: created.error };
  }

  // Заводить кандидата всё равно нужно — файл уже загружен, и просить
  // выбрать его заново было бы издевательством. Поэтому о совпадении
  // предупреждаем на следующем шаге, при проверке распознанных данных.
  //
  // "replace" — этот шаг не добавляется в историю браузера, а заменяет
  // собой страницу добавления. Добавление кандидата — путь из трёх
  // экранов (выбор файла → проверка данных → карточка), и промежуточные
  // в истории не нужны: вернуться человек хочет к списку кандидатов,
  // а не к форме, которую только что заполнил.
  redirect(
    `/candidates/${created.candidateId}/edit?parsed=1${created.duplicates.length > 0 ? "&duplicate=1" : ""}`,
    "replace",
  );
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

  const processed = await processResume(prepared.data, prepared.mimeType);
  const text = processed.text;

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
      textSource: processed.source,
      parseScore: processed.quality.score,
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
      resumes: {
        where: { isCurrent: true },
        orderBy: { uploadedAt: "desc" },
        take: 1,
      },
    },
  });

  const resume = candidate?.resumes[0];
  if (!candidate || !resume) return;

  // Файл перечитываем заново: разбор мог улучшиться с прошлого раза,
  // а сохранённый текст достался от старой версии. Заодно сработает
  // распознавание, если это скан.
  const data = await loadFile(resume.storageKey);
  const processed = await processResume(data, resume.mimeType);
  const { text, parsed } = processed;

  await db.resume.update({
    where: { id: resume.id },
    data: {
      parsedText: text.slice(0, 100_000),
      textSource: processed.source,
      parseScore: processed.quality.score,
    },
  });

  // Опыт и образование заменяем целиком: это результат разбора файла.
  await db.candidateExperience.deleteMany({
    where: { candidateId: candidate.id },
  });
  await db.candidateEducation.deleteMany({
    where: { candidateId: candidate.id },
  });

  // Фото сохраняем, только если его ещё нет: перечитывание не должно
  // затирать снимок, который рекрутер поставил вручную.
  const photoKey =
    candidate.photoKey ??
    (processed.photo
      ? await saveFile({
          companyId: scope.companyId,
          data: processed.photo.data,
          extension: processed.photo.extension,
          mimeType: processed.photo.mimeType,
        })
      : null);

  // Остальные поля трогаем, только если рекрутер их ещё не заполнил.
  await db.candidate.update({
    where: { id: candidate.id },
    data: {
      phone: candidate.phone ?? parsed.phone,
      email: candidate.email ?? parsed.email,
      city: candidate.city ?? parsed.city,
      photoKey,
      birthDate:
        candidate.birthDate ??
        (parsed.birthDate ? new Date(parsed.birthDate) : null),
      currentPosition: candidate.currentPosition ?? parsed.currentPosition,
      experienceYears: candidate.experienceYears ?? parsed.experienceYears,
      experienceMonths: processed.experienceMonths,
      salaryExpectation:
        candidate.salaryExpectation ?? parsed.salaryExpectation,
      telegram: candidate.telegram ?? parsed.telegram,
      skills: candidate.skills.length > 0 ? candidate.skills : parsed.skills,
      languages:
        candidate.languages.length > 0 ? candidate.languages : parsed.languages,
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
