"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { fieldErrorsFrom, interviewSchema } from "@/lib/validation";
import { addHistory } from "@/lib/history";
import { localToDate } from "@/lib/time";
import { INTERVIEW_TYPE_LABELS } from "@/lib/labels";
import { notify } from "@/lib/notifications";
import { formatDateTime } from "@/lib/format";
import type { InterviewStatus } from "@/generated/prisma/enums";

export type InterviewFormState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createInterview(
  candidateId: string,
  _prevState: InterviewFormState,
  formData: FormData,
): Promise<InterviewFormState> {
  const scope = await getScope();

  if (!scope.can("interviews.manage")) {
    return { formError: "Недостаточно прав для назначения интервью" };
  }

  const candidate = await db.candidate.findFirst({
    where: {
      id: candidateId,
      companyId: scope.companyId,
      ...candidateVisibilityFilter(scope.session.user),
    },
    select: { id: true, jobId: true, fullName: true },
  });

  if (!candidate) {
    return { formError: "Кандидат не найден" };
  }

  const durationRaw = text(formData, "durationMinutes");

  const parsed = interviewSchema.safeParse({
    type: text(formData, "type"),
    date: text(formData, "date"),
    time: text(formData, "time"),
    durationMinutes: durationRaw === "" ? null : Number(durationRaw),
    interviewerId: text(formData, "interviewerId") || null,
    comment: text(formData, "comment"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const scheduledAt = localToDate(parsed.data.date, parsed.data.time);
  if (!scheduledAt) {
    return { fieldErrors: { date: "Неверная дата или время" } };
  }

  // Интервьюер обязан работать в этой же компании.
  let interviewerId: string | null = null;
  if (parsed.data.interviewerId) {
    const interviewer = await db.user.findFirst({
      where: {
        id: parsed.data.interviewerId,
        companyId: scope.companyId,
        isActive: true,
      },
      select: { id: true },
    });
    interviewerId = interviewer?.id ?? null;
  }

  await db.interview.create({
    data: {
      companyId: scope.companyId,
      candidateId: candidate.id,
      jobId: candidate.jobId,
      type: parsed.data.type,
      scheduledAt,
      durationMinutes: parsed.data.durationMinutes,
      interviewerId,
      comment: parsed.data.comment || null,
      createdById: scope.session.user.id,
    },
  });

  await addHistory({
    companyId: scope.companyId,
    candidateId: candidate.id,
    type: "INTERVIEW_SCHEDULED",
    comment: INTERVIEW_TYPE_LABELS[parsed.data.type],
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
  });

  await notify({
    companyId: scope.companyId,
    userIds: [interviewerId],
    actorId: scope.session.user.id,
    type: "INTERVIEW_SCHEDULED",
    title: `Назначено интервью: ${candidate.fullName}`,
    body: `${INTERVIEW_TYPE_LABELS[parsed.data.type]} · ${formatDateTime(scheduledAt)}`,
    entityType: "Candidate",
    entityId: candidate.id,
  });

  revalidatePath(`/candidates/${candidate.id}`);
  revalidatePath("/interviews");

  return { success: "Интервью назначено" };
}

export async function setInterviewStatus(formData: FormData): Promise<void> {
  const scope = await getScope();
  if (!scope.can("interviews.manage")) {
    return;
  }

  const interviewId = text(formData, "interviewId");
  const status = text(formData, "status");

  if (!["SCHEDULED", "COMPLETED", "CANCELED"].includes(status)) {
    return;
  }

  const interview = await db.interview.findFirst({
    where: { id: interviewId, companyId: scope.companyId },
  });

  if (!interview) {
    return;
  }

  await db.interview.update({
    where: { id: interview.id },
    data: { status: status as InterviewStatus },
  });

  if (status === "COMPLETED") {
    await addHistory({
      companyId: scope.companyId,
      candidateId: interview.candidateId,
      type: "INTERVIEW_COMPLETED",
      comment: INTERVIEW_TYPE_LABELS[interview.type],
      actorId: scope.session.user.id,
      actorName: scope.session.user.fullName,
    });

    // После интервью от интервьюера ждут мнение.
    const candidate = await db.candidate.findUnique({
      where: { id: interview.candidateId },
      select: { fullName: true },
    });

    await notify({
      companyId: scope.companyId,
      userIds: [interview.interviewerId],
      actorId: scope.session.user.id,
      type: "FEEDBACK_REQUESTED",
      title: `Нужен фидбэк: ${candidate?.fullName ?? "кандидат"}`,
      body: `${INTERVIEW_TYPE_LABELS[interview.type]} проведено`,
      entityType: "Candidate",
      entityId: interview.candidateId,
    });
  }

  revalidatePath(`/candidates/${interview.candidateId}`);
  revalidatePath("/interviews");
}
