"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { feedbackSchema, fieldErrorsFrom } from "@/lib/validation";
import { addHistory } from "@/lib/history";
import { FEEDBACK_RESULT_LABELS } from "@/lib/labels";

export type FeedbackFormState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createFeedback(
  candidateId: string,
  _prevState: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const scope = await getScope();

  // Фидбэк может оставить любая роль, в том числе нанимающий менеджер.
  if (!scope.can("feedback.create")) {
    return { formError: "Недостаточно прав" };
  }

  const candidate = await db.candidate.findFirst({
    where: {
      id: candidateId,
      companyId: scope.companyId,
      ...candidateVisibilityFilter(scope.session.user),
    },
    select: { id: true, stageId: true },
  });

  if (!candidate) {
    return { formError: "Кандидат не найден" };
  }

  const parsed = feedbackSchema.safeParse({
    stageId: text(formData, "stageId") || null,
    interviewId: text(formData, "interviewId") || null,
    result: text(formData, "result"),
    comment: text(formData, "comment"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  // Этап и интервью обязаны принадлежать этой же компании и кандидату.
  let stageId: string | null = null;
  if (parsed.data.stageId) {
    const stage = await db.stage.findFirst({
      where: { id: parsed.data.stageId, companyId: scope.companyId },
      select: { id: true },
    });
    stageId = stage?.id ?? null;
  }

  let interviewId: string | null = null;
  if (parsed.data.interviewId) {
    const interview = await db.interview.findFirst({
      where: {
        id: parsed.data.interviewId,
        companyId: scope.companyId,
        candidateId: candidate.id,
      },
      select: { id: true },
    });
    interviewId = interview?.id ?? null;
  }

  await db.feedback.create({
    data: {
      companyId: scope.companyId,
      candidateId: candidate.id,
      stageId: stageId ?? candidate.stageId,
      interviewId,
      result: parsed.data.result,
      comment: parsed.data.comment,
      authorId: scope.session.user.id,
      authorName: scope.session.user.fullName,
    },
  });

  await addHistory({
    companyId: scope.companyId,
    candidateId: candidate.id,
    type: "FEEDBACK_ADDED",
    comment: FEEDBACK_RESULT_LABELS[parsed.data.result],
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
  });

  revalidatePath(`/candidates/${candidate.id}`);

  return { success: "Фидбэк добавлен" };
}
