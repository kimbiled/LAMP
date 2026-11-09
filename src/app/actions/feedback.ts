"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import {
  feedbackSchema,
  feedbackEditSchema,
  fieldErrorsFrom,
} from "@/lib/validation";
import { addHistory } from "@/lib/history";
import { logAction } from "@/lib/audit";
import { FEEDBACK_RESULT_LABELS } from "@/lib/labels";
import { jobWatchers, notify } from "@/lib/notifications";
import { done, fail, type ActionResult } from "@/lib/action-result";

export type FeedbackFormState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  // Что человек ввёл: при ошибке возвращаем, чтобы текст не пропал из формы.
  values?: { comment?: string; result?: string };
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
  const submitted = {
    comment: text(formData, "comment"),
    result: text(formData, "result"),
  };
  const scope = await getScope();

  // Отзыв может оставить любая роль, в том числе нанимающий менеджер.
  if (!scope.can("feedback.create")) {
    return { formError: "Недостаточно прав", values: submitted };
  }

  const candidate = await db.candidate.findFirst({
    where: {
      id: candidateId,
      companyId: scope.companyId,
      ...candidateVisibilityFilter(scope.session.user),
    },
    select: { id: true, stageId: true, jobId: true, fullName: true },
  });

  if (!candidate) {
    return { formError: "Кандидат не найден", values: submitted };
  }

  const parsed = feedbackSchema.safeParse({
    stageId: text(formData, "stageId") || null,
    interviewId: text(formData, "interviewId") || null,
    result: text(formData, "result"),
    comment: text(formData, "comment"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values: submitted };
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

  await notify({
    companyId: scope.companyId,
    userIds: await jobWatchers(candidate.jobId),
    actorId: scope.session.user.id,
    type: "FEEDBACK_ADDED",
    title: `Отзыв: ${candidate.fullName}`,
    body: `${scope.session.user.fullName} — ${FEEDBACK_RESULT_LABELS[parsed.data.result].toLowerCase()}`,
    entityType: "Candidate",
    entityId: candidate.id,
  });

  revalidatePath(`/candidates/${candidate.id}`);

  return { success: "Отзыв добавлен" };
}

// Правка и удаление чужого мнения — только администратору.
//
// Написать отзыв может любой, включая нанимающего менеджера: для него
// это основная работа. А вот менять или стирать написанное коллегой —
// право администратора. Иначе неудобное мнение можно тихо переписать,
// и история найма перестанет быть историей.
//
// Оба действия пишутся в журнал: кто, у кого и что именно тронул.

async function feedbackForManage(feedbackId: string) {
  const scope = await getScope();

  if (!scope.can("feedback.manage")) {
    return { error: "Менять и удалять отзыв может только администратор" };
  }

  // Отзыв обязан принадлежать той же компании: подставленный
  // в форму чужой идентификатор ничего не даст.
  const feedback = await db.feedback.findFirst({
    where: { id: feedbackId, companyId: scope.companyId },
    select: {
      id: true,
      candidateId: true,
      comment: true,
      result: true,
      authorName: true,
      author: { select: { fullName: true } },
    },
  });

  if (!feedback) return { error: "Отзыв не найден" };

  return { scope, feedback };
}

export async function updateFeedback(
  _prevState: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const submitted = {
    comment: text(formData, "comment"),
    result: text(formData, "result"),
  };
  const found = await feedbackForManage(text(formData, "feedbackId"));
  if ("error" in found) return { formError: found.error, values: submitted };

  const { scope, feedback } = found;

  const parsed = feedbackEditSchema.safeParse({
    result: text(formData, "result"),
    comment: text(formData, "comment"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values: submitted };
  }

  await db.feedback.update({
    where: { id: feedback.id },
    data: { result: parsed.data.result, comment: parsed.data.comment },
  });

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: "FEEDBACK_UPDATED",
    entityType: "Feedback",
    entityId: feedback.id,
    meta: {
      автор: feedback.author?.fullName ?? feedback.authorName ?? "гость",
      былоРешение: feedback.result,
      сталоРешение: parsed.data.result,
    },
  });

  revalidatePath(`/candidates/${feedback.candidateId}`);

  return { success: "Отзыв изменён" };
}

export async function deleteFeedback(
  _prevState: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const found = await feedbackForManage(text(formData, "feedbackId"));
  if ("error" in found) return { formError: found.error };

  const { scope, feedback } = found;

  await db.feedback.delete({ where: { id: feedback.id } });

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: "FEEDBACK_DELETED",
    entityType: "Feedback",
    entityId: feedback.id,
    meta: {
      автор: feedback.author?.fullName ?? feedback.authorName ?? "гость",
      решение: feedback.result,
      // Текст сохраняем в журнале: удалённое мнение должно оставаться
      // восстановимым хотя бы для разбора спорной ситуации.
      текст: (feedback.comment ?? "").slice(0, 500),
    },
  });

  revalidatePath(`/candidates/${feedback.candidateId}`);

  return { success: "Отзыв удалён" };
}

// «Предложить оффер» — кнопка нанимающего менеджера.
//
// Двигать кандидатов по этапам менеджер не может: это работа рекрутера.
// Но решение «берём» обычно принимает именно он, и раньше о нём
// узнавали в мессенджере. Теперь кнопка оставляет положительный отзыв
// с пометкой «Предлагаю оффер» и сразу сообщает администраторам
// компании и рекрутеру вакансии — колокольчиком в шапке.
export async function proposeOffer(formData: FormData): Promise<ActionResult> {
  const scope = await getScope();

  if (!scope.can("feedback.create")) {
    return fail("Недостаточно прав");
  }

  const candidateId = text(formData, "candidateId");
  const comment = text(formData, "comment").slice(0, 2000);

  const candidate = await db.candidate.findFirst({
    where: {
      id: candidateId,
      companyId: scope.companyId,
      ...candidateVisibilityFilter(scope.session.user),
    },
    select: {
      id: true,
      stageId: true,
      jobId: true,
      fullName: true,
      createdById: true,
      job: { select: { title: true, recruiterId: true } },
    },
  });

  if (!candidate) {
    return fail("Кандидат не найден");
  }

  await db.feedback.create({
    data: {
      companyId: scope.companyId,
      candidateId: candidate.id,
      stageId: candidate.stageId,
      result: "POSITIVE",
      comment: comment ? `Предлагаю сделать оффер. ${comment}` : "Предлагаю сделать оффер.",
      authorId: scope.session.user.id,
      authorName: scope.session.user.fullName,
    },
  });

  await addHistory({
    companyId: scope.companyId,
    candidateId: candidate.id,
    type: "FEEDBACK_ADDED",
    comment: "Предложен оффер",
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
  });

  // Кому сообщить: все активные администраторы и рекрутер вакансии.
  // Если вакансии нет — тот, кто завёл кандидата.
  const admins = await db.user.findMany({
    where: { companyId: scope.companyId, role: "ADMIN", isActive: true },
    select: { id: true },
  });

  await notify({
    companyId: scope.companyId,
    userIds: [
      ...admins.map((admin) => admin.id),
      candidate.job?.recruiterId ?? candidate.createdById,
    ],
    actorId: scope.session.user.id,
    type: "OFFER_PROPOSED",
    title: `Предлагают оффер: ${candidate.fullName}`,
    body:
      `${scope.session.user.fullName}` +
      (candidate.job ? ` · ${candidate.job.title}` : "") +
      (comment ? ` — «${comment}»` : ""),
    entityType: "Candidate",
    entityId: candidate.id,
  });

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: "OFFER_PROPOSED",
    entityType: "Candidate",
    entityId: candidate.id,
  });

  revalidatePath(`/candidates/${candidate.id}`);

  return done("Готово: администратор и рекрутер получили уведомление");
}
