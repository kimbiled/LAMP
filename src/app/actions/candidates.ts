"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { jobVisibilityFilter } from "@/lib/permissions";
import { candidateSchema, fieldErrorsFrom } from "@/lib/validation";
import { addHistory } from "@/lib/history";
import { normalizeTelegram } from "@/lib/contacts";
import { removeFile } from "@/lib/storage";

export type CandidateFormState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
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

function readForm(formData: FormData) {
  return {
    fullName: text(formData, "fullName"),
    jobId: text(formData, "jobId") || null,
    stageId: text(formData, "stageId"),
    phone: text(formData, "phone"),
    email: text(formData, "email").toLowerCase(),
    city: text(formData, "city"),
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
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const stageId = await validStageId(parsed.data.stageId, scope.companyId);
  if (!stageId) {
    return { fieldErrors: { stageId: "Этап не найден" } };
  }

  const candidate = await db.candidate.create({
    data: {
      companyId: scope.companyId,
      jobId: await validJobId(parsed.data.jobId, scope),
      stageId,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      city: parsed.data.city || null,
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
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const stageId = await validStageId(parsed.data.stageId, scope.companyId);
  if (!stageId) {
    return { fieldErrors: { stageId: "Этап не найден" } };
  }

  const stageChanged = stageId !== existing.stageId;

  await db.candidate.update({
    where: { id: existing.id },
    data: {
      jobId: await validJobId(parsed.data.jobId, scope),
      stageId,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      city: parsed.data.city || null,
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

  const candidate = await db.candidate.findFirst({
    where: { id: candidateId, companyId: scope.companyId },
  });

  if (!candidate || candidate.stageId === stageId) {
    return;
  }

  const validStage = await validStageId(stageId, scope.companyId);
  if (!validStage) {
    return;
  }

  await db.candidate.update({
    where: { id: candidate.id },
    data: { stageId: validStage, stageChangedAt: new Date() },
  });

  await addHistory({
    companyId: scope.companyId,
    candidateId: candidate.id,
    type: "STAGE_CHANGED",
    fromStageId: candidate.stageId,
    toStageId: validStage,
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
  });

  revalidatePath(`/candidates/${candidate.id}`);
  revalidatePath("/candidates");
}

export async function deleteCandidate(formData: FormData): Promise<void> {
  const scope = await getScope();
  if (!scope.can("candidates.delete")) {
    return;
  }

  const candidateId = text(formData, "candidateId");

  const candidate = await db.candidate.findFirst({
    where: { id: candidateId, companyId: scope.companyId },
    select: { id: true, resumes: { select: { storageKey: true } } },
  });

  if (!candidate) {
    return;
  }

  await db.candidate.delete({ where: { id: candidate.id } });

  // Записи в базе удалились каскадом, а файлы резюме лежат отдельно —
  // их нужно убрать с диска вручную.
  for (const resume of candidate.resumes) {
    await removeFile(resume.storageKey);
  }

  redirect("/candidates");
}
