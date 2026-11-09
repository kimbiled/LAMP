"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { localToDate } from "@/lib/time";
import { normalizeMeetingUrl } from "@/lib/meeting";
import { notify } from "@/lib/notifications";
import { done, fail, type ActionResult } from "@/lib/action-result";

// Встречи без кандидата: собрание (дэйлик, планёрка) и напоминание.
//
// Собрание может назначить любой сотрудник — администратор, рекрутер
// или нанимающий менеджер — и позвать коллег из своей компании.
// Каждый приглашённый получает уведомление и отвечает «Иду» или
// «Не смогу». Пока он не ответил, встреча у него в календаре серая.
//
// Напоминание — то же самое, но только для себя.

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

const DURATIONS = new Set([15, 30, 45, 60, 90, 120]);

function whenText(date: string, time: string): string {
  const [, month, day] = date.split("-");
  return `${day}.${month} в ${time}`;
}

export async function createMeeting(formData: FormData): Promise<ActionResult> {
  const scope = await getScope();
  const me = scope.session.user;

  const kind = text(formData, "kind") === "REMINDER" ? "REMINDER" : "DAILY";
  const title = text(formData, "title").slice(0, 200);
  const date = text(formData, "date");
  const time = text(formData, "time");
  const duration = Number(text(formData, "durationMinutes") || "30");
  const comment = text(formData, "comment").slice(0, 2000);
  const url = normalizeMeetingUrl(text(formData, "meetingUrl"));

  if (!title) {
    return fail(kind === "DAILY" ? "Напишите тему собрания" : "Напишите, о чём напомнить");
  }
  const scheduledAt = localToDate(date, time);
  if (!scheduledAt) return fail("Укажите дату и время");
  if (!DURATIONS.has(duration)) return fail("Неверная длительность");
  if (url === "invalid") return fail("Ссылка на встречу не похожа на адрес");

  // Участники — только активные сотрудники этой же компании.
  // id из формы проверяем по базе: чужого человека позвать нельзя.
  let invited: { id: string }[] = [];
  if (kind === "DAILY") {
    const ids = formData
      .getAll("attendeeIds")
      .filter((value): value is string => typeof value === "string" && value !== me.id);
    if (ids.length === 0) return fail("Позовите хотя бы одного коллегу");
    invited = await db.user.findMany({
      where: { id: { in: ids }, companyId: scope.companyId, isActive: true },
      select: { id: true },
    });
    if (invited.length === 0) return fail("Коллеги не найдены");
  }

  const meeting = await db.meeting.create({
    data: {
      companyId: scope.companyId,
      kind,
      title,
      scheduledAt,
      durationMinutes: duration,
      meetingUrl: url,
      comment: comment || null,
      createdById: me.id,
      attendees: {
        create: [
          // Организатор идёт на свою встречу — без вопросов.
          { userId: me.id, status: "ACCEPTED", respondedAt: new Date() },
          ...invited.map((user) => ({ userId: user.id })),
        ],
      },
    },
    select: { id: true },
  });

  if (invited.length > 0) {
    await notify({
      companyId: scope.companyId,
      userIds: invited.map((user) => user.id),
      actorId: me.id,
      type: "MEETING_INVITE",
      title: `Собрание: ${title}`,
      body: `${me.fullName} зовёт вас · ${whenText(date, time)}, ${duration} мин`,
      entityType: "Meeting",
      entityId: meeting.id,
    });
  }

  revalidatePath("/interviews");
  return done(
    kind === "DAILY"
      ? "Собрание назначено, коллеги получили приглашение"
      : "Напоминание добавлено",
  );
}

// Ответ на приглашение: «Иду» или «Не смогу».
export async function respondToMeeting(formData: FormData): Promise<ActionResult> {
  const scope = await getScope();
  const me = scope.session.user;
  const answer = text(formData, "answer") === "DECLINED" ? "DECLINED" : "ACCEPTED";

  const attendee = await db.meetingAttendee.findFirst({
    where: {
      meetingId: text(formData, "meetingId"),
      userId: me.id,
      meeting: { companyId: scope.companyId },
    },
    select: {
      id: true,
      meeting: { select: { id: true, title: true, createdById: true } },
    },
  });
  if (!attendee) return fail("Приглашение не найдено");

  await db.meetingAttendee.update({
    where: { id: attendee.id },
    data: { status: answer, respondedAt: new Date() },
  });

  // Приглашение прочитано: ответ уже дан.
  await db.notification.updateMany({
    where: { userId: me.id, entityType: "Meeting", entityId: attendee.meeting.id },
    data: { isRead: true },
  });

  await notify({
    companyId: scope.companyId,
    userIds: [attendee.meeting.createdById],
    actorId: me.id,
    type: "MEETING_RESPONSE",
    title: `${me.fullName}: ${answer === "ACCEPTED" ? "придёт" : "не сможет"}`,
    body: `Собрание «${attendee.meeting.title}»`,
    entityType: "Meeting",
    entityId: attendee.meeting.id,
  });

  revalidatePath("/interviews");
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return done(
    answer === "ACCEPTED" ? "Вы идёте — встреча в календаре" : "Вы отказались от собрания",
  );
}

// Отменить встречу может только тот, кто её назначил.
export async function cancelMeeting(formData: FormData): Promise<ActionResult> {
  const scope = await getScope();
  const me = scope.session.user;

  const meeting = await db.meeting.findFirst({
    where: {
      id: text(formData, "meetingId"),
      companyId: scope.companyId,
      createdById: me.id,
    },
    select: { id: true, title: true, kind: true, attendees: { select: { userId: true } } },
  });
  if (!meeting) return fail("Отменить встречу может только тот, кто её назначил");

  await db.meeting.delete({ where: { id: meeting.id } });

  if (meeting.kind === "DAILY") {
    await notify({
      companyId: scope.companyId,
      userIds: meeting.attendees.map((item) => item.userId),
      actorId: me.id,
      type: "MEETING_RESPONSE",
      title: `Собрание отменено: ${meeting.title}`,
      body: `Отменил(а) ${me.fullName}`,
    });
  }

  revalidatePath("/interviews");
  return done("Встреча отменена");
}
