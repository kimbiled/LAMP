"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { jobVisibilityFilter } from "@/lib/permissions";
import { candidateSchema, fieldErrorsFrom } from "@/lib/validation";
import { addHistory } from "@/lib/history";
import { normalizeTelegram, phoneKey } from "@/lib/contacts";
import { findDuplicates, type DuplicateMatch } from "@/lib/duplicates";
import { rejectionSide, isKnownReason, rejectionLabel } from "@/lib/rejection";
import { removeFile } from "@/lib/storage";
import { jobWatchers, notify } from "@/lib/notifications";
import { logAction } from "@/lib/audit";

export type CandidateFormState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
  // Найденные однофамильцы по телефону или почте. Форма показывает их
  // и ждёт решения: открыть существующего или всё-таки создать нового.
  duplicates?: DuplicateMatch[];
  // Введённое возвращаем обратно в форму: React после отправки
  // очищает поля, и без этого пришлось бы набирать всё заново.
  values?: Record<string, string>;
};

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(formData: FormData, name: string): number | null {
  const raw = text(formData, name).replace(/\s/g, "");
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
}

// «React, TypeScript, Figma» превращаем в список из трёх значений.
function list(formData: FormData, name: string): string[] {
  return text(formData, name)
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 50);
}

// Опыт работы и образование приходят из формы параллельными списками:
// на каждое место работы по одному значению в каждом поле.
function readExperience(formData: FormData) {
  const companies = formData.getAll("expCompany").map(String);
  const positions = formData.getAll("expPosition").map(String);
  const periods = formData.getAll("expPeriod").map(String);
  const descriptions = formData.getAll("expDescription").map(String);

  return companies
    .map((companyName, index) => ({
      companyName: companyName.trim().slice(0, 150),
      position: positions[index]?.trim().slice(0, 150) || null,
      period: periods[index]?.trim().slice(0, 100) || null,
      description: descriptions[index]?.trim().slice(0, 3000) || null,
      sortOrder: index,
    }))
    .filter((item) => item.companyName.length > 0)
    .slice(0, 20);
}

function readEducation(formData: FormData) {
  const institutions = formData.getAll("eduInstitution").map(String);
  const specialties = formData.getAll("eduSpecialty").map(String);
  const years = formData.getAll("eduYears").map(String);

  return institutions
    .map((institution, index) => ({
      institution: institution.trim().slice(0, 200),
      specialty: specialties[index]?.trim().slice(0, 200) || null,
      years: years[index]?.trim().slice(0, 50) || null,
      sortOrder: index,
    }))
    .filter((item) => item.institution.length > 0)
    .slice(0, 20);
}

function readForm(formData: FormData) {
  return {
    fullName: text(formData, "fullName"),
    jobId: text(formData, "jobId") || null,
    stageId: text(formData, "stageId"),
    phone: text(formData, "phone"),
    email: text(formData, "email").toLowerCase(),
    city: text(formData, "city"),
    birthDate: text(formData, "birthDate"),
    currentPosition: text(formData, "currentPosition"),
    experienceYears: numberOrNull(formData, "experienceYears"),
    salaryExpectation: numberOrNull(formData, "salaryExpectation"),
    currency: text(formData, "currency") || "KZT",
    telegram: text(formData, "telegram"),
    skills: list(formData, "skills"),
    languages: list(formData, "languages"),
    source: text(formData, "source"),
    note: text(formData, "note"),
  };
}

// То же самое, но строками — чтобы вернуть в форму ровно то,
// что человек набрал, включая незаполненные и ошибочные поля.
const FORM_FIELDS = [
  "fullName",
  "jobId",
  "stageId",
  "phone",
  "email",
  "city",
  "birthDate",
  "currentPosition",
  "experienceYears",
  "salaryExpectation",
  "currency",
  "telegram",
  "skills",
  "languages",
  "source",
  "note",
];

function rawValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    FORM_FIELDS.map((name) => [name, text(formData, name)]),
  );
}

// Вакансия должна принадлежать компании и быть доступна этому человеку.
async function validJobId(
  jobId: string | null,
  scope: Awaited<ReturnType<typeof getScope>>,
): Promise<string | null> {
  if (!jobId) return null;
  const job = await db.job.findFirst({
    where: {
      id: jobId,
      companyId: scope.companyId,
      ...jobVisibilityFilter(scope.session.user),
    },
    select: { id: true },
  });
  return job?.id ?? null;
}

async function validStageId(
  stageId: string,
  companyId: string,
): Promise<string | null> {
  const stage = await db.stage.findFirst({
    where: { id: stageId, companyId },
    select: { id: true },
  });
  return stage?.id ?? null;
}

export async function createCandidate(
  _prevState: CandidateFormState,
  formData: FormData,
): Promise<CandidateFormState> {
  const scope = await getScope();

  if (!scope.can("candidates.create")) {
    return { formError: "Недостаточно прав для добавления кандидатов" };
  }

  const parsed = candidateSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: rawValues(formData),
    };
  }

  const stageId = await validStageId(parsed.data.stageId, scope.companyId);
  if (!stageId) {
    return {
      fieldErrors: { stageId: "Этап не найден" },
      values: rawValues(formData),
    };
  }

  // Не запрещаем, а предупреждаем: бывают и однофамильцы с общим
  // рабочим телефоном. Решение остаётся за рекрутером — второй раз
  // та же форма приходит с отметкой «создавать всё равно».
  if (text(formData, "ignoreDuplicates") !== "true") {
    const duplicates = await findDuplicates({
      companyId: scope.companyId,
      phone: parsed.data.phone,
      email: parsed.data.email,
    });

    if (duplicates.length > 0) {
      return { duplicates, values: rawValues(formData) };
    }
  }

  const candidate = await db.candidate.create({
    data: {
      companyId: scope.companyId,
      jobId: await validJobId(parsed.data.jobId, scope),
      stageId,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
      phoneKey: phoneKey(parsed.data.phone),
      email: parsed.data.email || null,
      city: parsed.data.city || null,
      birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
      currentPosition: parsed.data.currentPosition || null,
      experienceYears: parsed.data.experienceYears,
      salaryExpectation: parsed.data.salaryExpectation,
      currency: parsed.data.currency,
      telegram: normalizeTelegram(parsed.data.telegram),
      skills: parsed.data.skills,
      languages: parsed.data.languages,
      source: parsed.data.source || null,
      note: parsed.data.note || null,
      createdById: scope.session.user.id,
      experience: { create: readExperience(formData) },
      education: { create: readEducation(formData) },
    },
  });

  await addHistory({
    companyId: scope.companyId,
    candidateId: candidate.id,
    type: "CANDIDATE_CREATED",
    toStageId: stageId,
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
  });

  await notify({
    companyId: scope.companyId,
    userIds: await jobWatchers(candidate.jobId),
    actorId: scope.session.user.id,
    type: "CANDIDATE_ASSIGNED",
    title: `Новый кандидат: ${candidate.fullName}`,
    body: candidate.currentPosition,
    entityType: "Candidate",
    entityId: candidate.id,
  });

  redirect(`/candidates/${candidate.id}`);
}

export async function updateCandidate(
  candidateId: string,
  _prevState: CandidateFormState,
  formData: FormData,
): Promise<CandidateFormState> {
  const scope = await getScope();

  if (!scope.can("candidates.edit")) {
    return { formError: "Недостаточно прав для изменения кандидатов" };
  }

  const existing = await db.candidate.findFirst({
    where: { id: candidateId, companyId: scope.companyId },
  });

  if (!existing) {
    return { formError: "Кандидат не найден" };
  }

  const parsed = candidateSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: rawValues(formData),
    };
  }

  const stageId = await validStageId(parsed.data.stageId, scope.companyId);
  if (!stageId) {
    return {
      fieldErrors: { stageId: "Этап не найден" },
      values: rawValues(formData),
    };
  }

  const stageChanged = stageId !== existing.stageId;

  await db.candidate.update({
    where: { id: existing.id },
    data: {
      jobId: await validJobId(parsed.data.jobId, scope),
      stageId,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
      phoneKey: phoneKey(parsed.data.phone),
      email: parsed.data.email || null,
      city: parsed.data.city || null,
      birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
      currentPosition: parsed.data.currentPosition || null,
      experienceYears: parsed.data.experienceYears,
      salaryExpectation: parsed.data.salaryExpectation,
      currency: parsed.data.currency,
      telegram: normalizeTelegram(parsed.data.telegram),
      skills: parsed.data.skills,
      languages: parsed.data.languages,
      source: parsed.data.source || null,
      note: parsed.data.note || null,
      ...(stageChanged ? { stageChangedAt: new Date() } : {}),
      // Списки заменяем, только если форма их прислала. Если полей нет
      // (например, открыта старая версия страницы), уже сохранённый
      // опыт работы и образование трогать нельзя — иначе они пропадут.
      ...(formData.has("expCompany")
        ? { experience: { deleteMany: {}, create: readExperience(formData) } }
        : {}),
      ...(formData.has("eduInstitution")
        ? { education: { deleteMany: {}, create: readEducation(formData) } }
        : {}),
    },
  });

  await addHistory({
    companyId: scope.companyId,
    candidateId: existing.id,
    type: stageChanged ? "STAGE_CHANGED" : "CANDIDATE_UPDATED",
    fromStageId: stageChanged ? existing.stageId : null,
    toStageId: stageChanged ? stageId : null,
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
  });

  redirect(`/candidates/${existing.id}`);
}

export async function moveCandidateToStage(formData: FormData): Promise<void> {
  const scope = await getScope();
  if (!scope.can("candidates.move")) {
    return;
  }

  const candidateId = text(formData, "candidateId");
  const stageId = text(formData, "stageId");
  const comment = text(formData, "comment").slice(0, 1000);

  const candidate = await db.candidate.findFirst({
    where: { id: candidateId, companyId: scope.companyId },
  });

  if (!candidate || candidate.stageId === stageId) {
    return;
  }

  // Ключ этапа нужен сразу: по нему понятно, отказ это или нет.
  const stage = await db.stage.findFirst({
    where: { id: stageId, companyId: scope.companyId },
    select: { id: true, name: true, key: true },
  });

  if (!stage) {
    return;
  }

  const validStage = stage.id;

  // Причину спрашиваем только на двух этапах отказа. Её можно
  // пропустить — тогда просто останется пусто.
  const side = rejectionSide(stage.key);
  const reasonCode = text(formData, "rejectionReason");
  const reason = side && isKnownReason(side, reasonCode) ? reasonCode : null;
  const reasonComment = text(formData, "rejectionComment").slice(0, 1000);

  await db.candidate.update({
    where: { id: candidate.id },
    data: {
      stageId: validStage,
      stageChangedAt: new Date(),
      // Человек вернулся в работу — прежняя причина отказа больше не про него.
      rejectionReason: side ? reason : null,
      rejectionComment: side ? reasonComment || null : null,
    },
  });

  // В истории причина видна текстом: через полгода коды никто не помнит.
  const historyComment =
    [
      reason ? rejectionLabel(reason) : null,
      reasonComment || null,
      comment || null,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  await addHistory({
    companyId: scope.companyId,
    candidateId: candidate.id,
    type: "STAGE_CHANGED",
    fromStageId: candidate.stageId,
    toStageId: validStage,
    comment: historyComment,
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
  });

  await notify({
    companyId: scope.companyId,
    userIds: await jobWatchers(candidate.jobId),
    actorId: scope.session.user.id,
    type: "STAGE_CHANGED",
    title: `Новый этап: ${candidate.fullName}`,
    body: `Переведён на «${stage.name}»`,
    entityType: "Candidate",
    entityId: candidate.id,
  });

  revalidatePath(`/candidates/${candidate.id}`);
  revalidatePath("/candidates");
  if (candidate.jobId) {
    revalidatePath(`/jobs/${candidate.jobId}`);
  }
}

export async function deleteCandidate(formData: FormData): Promise<void> {
  const scope = await getScope();
  if (!scope.can("candidates.delete")) {
    return;
  }

  const candidateId = text(formData, "candidateId");

  const candidate = await db.candidate.findFirst({
    where: { id: candidateId, companyId: scope.companyId },
    select: {
      id: true,
      fullName: true,
      resumes: { select: { storageKey: true } },
    },
  });

  if (!candidate) {
    return;
  }

  await db.candidate.delete({ where: { id: candidate.id } });

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: "CANDIDATE_DELETED",
    entityType: "Candidate",
    entityId: candidate.id,
    meta: { fullName: candidate.fullName },
  });

  // Записи в базе удалились каскадом, а файлы резюме лежат отдельно —
  // их нужно убрать с диска вручную.
  for (const resume of candidate.resumes) {
    await removeFile(resume.storageKey);
  }

  redirect("/candidates");
}
