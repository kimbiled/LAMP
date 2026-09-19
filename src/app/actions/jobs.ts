"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { fieldErrorsFrom, jobSchema } from "@/lib/validation";
import type { JobStatus } from "@/generated/prisma/enums";

export type JobFormState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
};

const STATUSES: JobStatus[] = ["OPEN", "PAUSED", "CLOSED"];

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Пустое поле зарплаты — это «не указано», а не ноль.
function numberOrNull(formData: FormData, name: string): number | null {
  const raw = text(formData, name).replace(/\s/g, "");
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
}

function idOrNull(formData: FormData, name: string): string | null {
  const value = text(formData, name);
  return value === "" ? null : value;
}

// Проверяем, что назначенный человек действительно работает в этой компании.
// Иначе можно было бы подставить чужой идентификатор в форму.
async function validUserId(
  userId: string | null,
  companyId: string,
): Promise<string | null> {
  if (!userId) return null;
  const user = await db.user.findFirst({
    where: { id: userId, companyId, isActive: true },
    select: { id: true },
  });
  return user?.id ?? null;
}

function readJobForm(formData: FormData) {
  return {
    title: text(formData, "title"),
    description: text(formData, "description"),
    requirements: text(formData, "requirements"),
    salaryMin: numberOrNull(formData, "salaryMin"),
    salaryMax: numberOrNull(formData, "salaryMax"),
    currency: text(formData, "currency") || "KZT",
    status: text(formData, "status"),
    recruiterId: idOrNull(formData, "recruiterId"),
    hiringManagerId: idOrNull(formData, "hiringManagerId"),
  };
}

export async function createJob(
  _prevState: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const scope = await getScope();

  if (!scope.can("jobs.manage")) {
    return { formError: "Недостаточно прав для создания вакансий" };
  }

  const parsed = jobSchema.safeParse(readJobForm(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const job = await db.job.create({
    data: {
      companyId: scope.companyId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      requirements: parsed.data.requirements || null,
      salaryMin: parsed.data.salaryMin,
      salaryMax: parsed.data.salaryMax,
      currency: parsed.data.currency,
      status: parsed.data.status,
      recruiterId: await validUserId(parsed.data.recruiterId, scope.companyId),
      hiringManagerId: await validUserId(
        parsed.data.hiringManagerId,
        scope.companyId,
      ),
      createdById: scope.session.user.id,
    },
  });

  redirect(`/jobs/${job.id}`);
}

export async function updateJob(
  jobId: string,
  _prevState: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const scope = await getScope();

  if (!scope.can("jobs.manage")) {
    return { formError: "Недостаточно прав для изменения вакансий" };
  }

  // findFirst с companyId: чужая вакансия просто не найдётся.
  const existing = await db.job.findFirst({
    where: { id: jobId, companyId: scope.companyId },
    select: { id: true },
  });

  if (!existing) {
    return { formError: "Вакансия не найдена" };
  }

  const parsed = jobSchema.safeParse(readJobForm(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await db.job.update({
    where: { id: existing.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      requirements: parsed.data.requirements || null,
      salaryMin: parsed.data.salaryMin,
      salaryMax: parsed.data.salaryMax,
      currency: parsed.data.currency,
      status: parsed.data.status,
      recruiterId: await validUserId(parsed.data.recruiterId, scope.companyId),
      hiringManagerId: await validUserId(
        parsed.data.hiringManagerId,
        scope.companyId,
      ),
    },
  });

  redirect(`/jobs/${existing.id}`);
}

export async function changeJobStatus(formData: FormData): Promise<void> {
  const scope = await getScope();
  if (!scope.can("jobs.manage")) {
    return;
  }

  const jobId = text(formData, "jobId");
  const status = text(formData, "status");

  if (!STATUSES.includes(status as JobStatus)) {
    return;
  }

  const job = await db.job.findFirst({
    where: { id: jobId, companyId: scope.companyId },
    select: { id: true },
  });

  if (!job) {
    return;
  }

  await db.job.update({
    where: { id: job.id },
    data: { status: status as JobStatus },
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${job.id}`);
}
