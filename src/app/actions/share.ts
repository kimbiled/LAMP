"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { addHistory } from "@/lib/history";
import { findValidShareLink } from "@/lib/share";
import { jobWatchers, notify } from "@/lib/notifications";
import { logAction } from "@/lib/audit";

export type ShareFormState = {
  formError?: string;
  success?: string;
};

export type GuestFeedbackState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  // Что ввёл гость: при ошибке возвращаем, чтобы текст не пропал.
  values?: { authorName?: string; result?: string; comment?: string };
};

const MAX_GUEST_FEEDBACKS_PER_LINK = 20;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// ---------- управление ссылками (внутри системы) ----------

export async function createShareLink(
  candidateId: string,
  _prevState: ShareFormState,
  formData: FormData,
): Promise<ShareFormState> {
  const scope = await getScope();

  if (!scope.can("share.create")) {
    return { formError: "Недостаточно прав для создания ссылок" };
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

  const days = Number(text(formData, "expiresInDays"));
  const expiresAt =
    Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      : null;

  // 32 случайных байта — подобрать такую ссылку перебором невозможно.
  const token = randomBytes(32).toString("hex");

  await db.shareLink.create({
    data: {
      companyId: scope.companyId,
      candidateId: candidate.id,
      token,
      createdById: scope.session.user.id,
      expiresAt,
    },
  });

  await addHistory({
    companyId: scope.companyId,
    candidateId: candidate.id,
    type: "SHARE_LINK_CREATED",
    comment: expiresAt ? null : "Бессрочная ссылка",
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
  });

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: "SHARE_LINK_CREATED",
    entityType: "Candidate",
    entityId: candidate.id,
    meta: { expiresAt: expiresAt ? expiresAt.toISOString() : "без срока" },
  });

  revalidatePath(`/candidates/${candidate.id}`);

  return { success: "Ссылка создана" };
}

export async function revokeShareLink(formData: FormData): Promise<void> {
  const scope = await getScope();
  if (!scope.can("share.create")) {
    return;
  }

  const linkId = text(formData, "linkId");

  const link = await db.shareLink.findFirst({
    where: { id: linkId, companyId: scope.companyId },
  });

  if (!link || link.revokedAt) {
    return;
  }

  await db.shareLink.update({
    where: { id: link.id },
    data: { revokedAt: new Date() },
  });

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: "SHARE_LINK_REVOKED",
    entityType: "Candidate",
    entityId: link.candidateId,
  });

  revalidatePath(`/candidates/${link.candidateId}`);
}

// ---------- публичная часть (без входа в систему) ----------

export async function submitGuestFeedback(
  token: string,
  _prevState: GuestFeedbackState,
  formData: FormData,
): Promise<GuestFeedbackState> {
  const link = await findValidShareLink(token);

  if (!link) {
    return { formError: "Ссылка больше не действует" };
  }

  const authorName = text(formData, "authorName");
  const result = text(formData, "result");
  const comment = text(formData, "comment");

  const fieldErrors: Record<string, string> = {};

  if (authorName.length < 2 || authorName.length > 100) {
    fieldErrors.authorName = "Представьтесь, пожалуйста";
  }

  if (!["POSITIVE", "NEGATIVE", "EXTRA_STAGE"].includes(result)) {
    fieldErrors.result = "Выберите результат";
  }

  if (comment.length < 3 || comment.length > 4000) {
    fieldErrors.comment = "Напишите хотя бы пару слов";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values: { authorName, result, comment } };
  }

  // Простая защита от спама по одной ссылке.
  const alreadyLeft = await db.feedback.count({
    where: { shareLinkId: link.id },
  });

  if (alreadyLeft >= MAX_GUEST_FEEDBACKS_PER_LINK) {
    return {
      formError:
        "По этой ссылке оставлено слишком много отзывов. Попросите новую ссылку",
    };
  }

  const candidate = await db.candidate.findUnique({
    where: { id: link.candidateId },
    select: { stageId: true, jobId: true, fullName: true },
  });

  await db.feedback.create({
    data: {
      companyId: link.companyId,
      candidateId: link.candidateId,
      stageId: candidate?.stageId ?? null,
      result: result as "POSITIVE" | "NEGATIVE" | "EXTRA_STAGE",
      comment,
      authorId: null,
      authorName,
      shareLinkId: link.id,
    },
  });

  await addHistory({
    companyId: link.companyId,
    candidateId: link.candidateId,
    type: "FEEDBACK_ADDED",
    comment: "Через ссылку «Поделиться»",
    actorName: authorName,
  });

  // Гость не входит в систему, поэтому уведомляем всех, кто ведёт вакансию.
  await notify({
    companyId: link.companyId,
    userIds: await jobWatchers(candidate?.jobId ?? null),
    type: "FEEDBACK_ADDED",
    title: `Отзыв по ссылке: ${candidate?.fullName ?? "кандидат"}`,
    body: `${authorName} оставил отзыв`,
    entityType: "Candidate",
    entityId: link.candidateId,
  });

  revalidatePath(`/share/${token}`);
  revalidatePath(`/candidates/${link.candidateId}`);

  return { success: "Спасибо! Отзыв сохранён" };
}
