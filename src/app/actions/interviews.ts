"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { fieldErrorsFrom, interviewSchema } from "@/lib/validation";
import { addHistory } from "@/lib/history";
import { localToDate } from "@/lib/time";
import { INTERVIEW_TYPE_LABELS } from "@/lib/labels";
import { jobWatchers, notify } from "@/lib/notifications";
import { formatDateTime } from "@/lib/format";
import { suggestSlots, type Suggestion } from "@/lib/slots";
import { nextProgressStage } from "@/lib/stages";
import { isKnownReason, rejectionLabel } from "@/lib/rejection";
import { normalizeMeetingUrl, readInterviewFormat } from "@/lib/meeting";
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

// Ссылка на встречу из формы. undefined — поля в форме нет (открыта
// старая версия страницы): тогда уже сохранённую ссылку не трогаем.
function readMeetingUrl(
  formData: FormData,
): { ok: true; value: string | null | undefined } | { ok: false } {
  if (!formData.has("meetingUrl")) return { ok: true, value: undefined };
  const value = normalizeMeetingUrl(text(formData, "meetingUrl"));
  return value === "invalid" ? { ok: false } : { ok: true, value };
}

const MEETING_URL_ERROR = {
  meetingUrl: "Вставьте ссылку целиком, например https://meet.google.com/abc-defg-hij",
};

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

  const meetingUrl = readMeetingUrl(formData);
  if (!meetingUrl.ok) {
    return { fieldErrors: MEETING_URL_ERROR };
  }
  const format = readInterviewFormat(formData.get("format"));

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
      // В офисе ссылка не нужна: стираем, чтобы не было «Подключиться».
      meetingUrl: format === "OFFICE" ? null : (meetingUrl.value ?? null),
      format: format ?? (meetingUrl.value ? "ONLINE" : null),
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
      title: `Нужен отзыв: ${candidate?.fullName ?? "кандидат"}`,
      body: `${INTERVIEW_TYPE_LABELS[interview.type]} проведено`,
      entityType: "Candidate",
      entityId: interview.candidateId,
    });
  }

  revalidatePath(`/candidates/${interview.candidateId}`);
  revalidatePath("/interviews");
}

// ---------- Календарь ----------
//
// В карточке кандидата интервью назначается «этому человеку», поэтому
// кандидат берётся из адреса. В календаре наоборот: сначала выбирают
// время, а кандидата указывают в форме. Отсюда отдельное действие.

export async function scheduleInterview(
  _prevState: InterviewFormState,
  formData: FormData,
): Promise<InterviewFormState> {
  const scope = await getScope();

  if (!scope.can("interviews.manage")) {
    return { formError: "Недостаточно прав для назначения интервью" };
  }

  const candidate = await db.candidate.findFirst({
    where: {
      id: text(formData, "candidateId"),
      companyId: scope.companyId,
      ...candidateVisibilityFilter(scope.session.user),
    },
    select: { id: true, jobId: true, fullName: true },
  });

  if (!candidate) {
    return { fieldErrors: { candidateId: "Выберите кандидата" } };
  }

  return createInterview(candidate.id, _prevState, formData);
}

// Перенос назначенного интервью на другое время.
export async function rescheduleInterview(
  _prevState: InterviewFormState,
  formData: FormData,
): Promise<InterviewFormState> {
  const scope = await getScope();

  if (!scope.can("interviews.manage")) {
    return { formError: "Недостаточно прав для переноса интервью" };
  }

  const interview = await db.interview.findFirst({
    where: { id: text(formData, "interviewId"), companyId: scope.companyId },
    select: {
      id: true,
      candidateId: true,
      scheduledAt: true,
      candidate: { select: { fullName: true } },
    },
  });

  if (!interview) {
    return { formError: "Интервью не найдено" };
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

  const meetingUrl = readMeetingUrl(formData);
  if (!meetingUrl.ok) {
    return { fieldErrors: MEETING_URL_ERROR };
  }
  const format = readInterviewFormat(formData.get("format"));

  const scheduledAt = localToDate(parsed.data.date, parsed.data.time);
  if (!scheduledAt) {
    return { fieldErrors: { date: "Неверная дата или время" } };
  }

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

  const moved = scheduledAt.getTime() !== interview.scheduledAt.getTime();

  await db.interview.update({
    where: { id: interview.id },
    data: {
      type: parsed.data.type,
      scheduledAt,
      durationMinutes: parsed.data.durationMinutes,
      interviewerId,
      comment: parsed.data.comment || null,
      ...(format ? { format } : {}),
      ...(format === "OFFICE"
        ? { meetingUrl: null }
        : meetingUrl.value !== undefined
          ? { meetingUrl: meetingUrl.value }
          : {}),
    },
  });

  if (moved) {
    await addHistory({
      companyId: scope.companyId,
      candidateId: interview.candidateId,
      type: "INTERVIEW_SCHEDULED",
      comment: `Перенесено на ${formatDateTime(scheduledAt)}`,
      actorId: scope.session.user.id,
      actorName: scope.session.user.fullName,
    });

    await notify({
      companyId: scope.companyId,
      userIds: [interviewerId],
      actorId: scope.session.user.id,
      type: "INTERVIEW_SCHEDULED",
      title: `Интервью перенесено: ${interview.candidate.fullName}`,
      body: formatDateTime(scheduledAt),
      entityType: "Candidate",
      entityId: interview.candidateId,
    });
  }

  revalidatePath(`/candidates/${interview.candidateId}`);
  revalidatePath("/interviews");

  return { success: moved ? "Интервью перенесено" : "Изменения сохранены" };
}

// Подбор ближайших свободных окон. Вызывается из окна назначения,
// когда нажимают «Подобрать время».
export async function findFreeSlots(params: {
  interviewerId?: string | null;
  candidateId?: string | null;
  durationMinutes?: number | null;
}): Promise<Suggestion[]> {
  const scope = await getScope();

  if (!scope.can("interviews.manage")) {
    return [];
  }

  return suggestSlots({
    companyId: scope.companyId,
    interviewerId: params.interviewerId ?? null,
    candidateId: params.candidateId ?? null,
    durationMinutes: params.durationMinutes ?? null,
  });
}

// Решение по итогам интервью прямо из календаря.
//
// Одно нажатие делает три вещи: записывает мнение в отзывы,
// закрывает интервью как проведённое и двигает кандидата —
// на следующую ступень воронки или в «Отказ от нас».
//
// Двигает только если у человека есть на это право. Нанимающий
// менеджер обычно может оставить мнение, но не переставлять этапы:
// тогда его решение просто записывается, а переводит рекрутер.
export async function decideAfterInterview(
  formData: FormData,
): Promise<InterviewFormState> {
  const scope = await getScope();

  if (!scope.can("feedback.create")) {
    return { formError: "Недостаточно прав" };
  }

  const decision = text(formData, "decision");
  if (decision !== "NEXT" && decision !== "REJECT") {
    return { formError: "Неизвестное решение" };
  }

  const interview = await db.interview.findFirst({
    where: {
      id: text(formData, "interviewId"),
      companyId: scope.companyId,
      candidate: candidateVisibilityFilter(scope.session.user),
    },
    select: {
      id: true,
      type: true,
      candidateId: true,
      interviewerId: true,
      candidate: {
        select: {
          id: true,
          fullName: true,
          jobId: true,
          stageId: true,
          stage: { select: { key: true } },
        },
      },
    },
  });

  if (!interview) {
    return { formError: "Интервью не найдено" };
  }

  const approved = decision === "NEXT";
  // Причина отказа — та же, что спрашивает окно смены этапа. Без неё
  // в аналитике отказов была дыра: из календаря отказы шли пустыми.
  const reasonCode = text(formData, "rejectionReason");
  const reason =
    !approved && isKnownReason("WE", reasonCode) ? reasonCode : null;
  const comment =
    text(formData, "comment").slice(0, 2000) ||
    (approved
      ? `Рекомендую дальше по итогам «${INTERVIEW_TYPE_LABELS[interview.type]}»`
      : `Отказ по итогам «${INTERVIEW_TYPE_LABELS[interview.type]}»`);

  await db.feedback.create({
    data: {
      companyId: scope.companyId,
      candidateId: interview.candidateId,
      interviewId: interview.id,
      stageId: interview.candidate.stageId,
      result: approved ? "POSITIVE" : "NEGATIVE",
      comment,
      authorId: scope.session.user.id,
    },
  });

  await db.interview.update({
    where: { id: interview.id },
    data: { status: "COMPLETED" },
  });

  await addHistory({
    companyId: scope.companyId,
    candidateId: interview.candidateId,
    type: "FEEDBACK_ADDED",
    comment,
    actorId: scope.session.user.id,
    actorName: scope.session.user.fullName,
  });

  // Куда двигать кандидата. Для отказа это «Отказ от нас»,
  // для одобрения — следующая ступень воронки, если она есть.
  let movedTo: string | null = null;

  if (scope.can("candidates.move")) {
    // Следующий этап ищем по порядку из настроек, а не по системному
    // ключу: иначе этапы, добавленные компанией, пропускались бы.
    const stages = await db.stage.findMany({
      where: { companyId: scope.companyId },
      orderBy: { position: "asc" },
      select: { id: true, name: true, key: true },
    });

    const stage = approved
      ? nextProgressStage(stages, interview.candidate.stageId)
      : (stages.find((item) => item.key === "WE_DECLINED") ?? null);

    if (stage && stage.id !== interview.candidate.stageId) {
      await db.candidate.update({
        where: { id: interview.candidateId },
        data: {
          stageId: stage.id,
          stageChangedAt: new Date(),
          rejectionReason: reason,
          rejectionComment: approved ? null : text(formData, "comment").slice(0, 1000) || null,
        },
      });

      await addHistory({
        companyId: scope.companyId,
        candidateId: interview.candidateId,
        type: "STAGE_CHANGED",
        fromStageId: interview.candidate.stageId,
        toStageId: stage.id,
        comment: reason
          ? `По итогам интервью · ${rejectionLabel(reason)}`
          : "По итогам интервью",
        actorId: scope.session.user.id,
        actorName: scope.session.user.fullName,
      });

      movedTo = stage.name;
    }
  }

  await notify({
    companyId: scope.companyId,
    userIds: await jobWatchers(interview.candidate.jobId),
    actorId: scope.session.user.id,
    type: "FEEDBACK_ADDED",
    title: `${approved ? "Рекомендован дальше" : "Отказ"}: ${interview.candidate.fullName}`,
    body: movedTo ? `Переведён на «${movedTo}»` : comment,
    entityType: "Candidate",
    entityId: interview.candidateId,
  });

  revalidatePath("/interviews");
  revalidatePath(`/candidates/${interview.candidateId}`);
  revalidatePath("/candidates");

  return {
    success: movedTo
      ? `Записано, кандидат переведён на «${movedTo}»`
      : "Решение записано",
  };
}
