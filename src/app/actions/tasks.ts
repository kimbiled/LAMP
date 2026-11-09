"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { done, fail, type ActionResult } from "@/lib/action-result";

// Блокнот: личные дела и заметки.
//
// Всё личное: человек видит, меняет и удаляет только свои записи.
// Поэтому в каждом запросе стоит и companyId, и userId из сессии —
// id записи из формы сам по себе ничего не открывает.

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// День хранится как полночь по UTC: это «число в календаре», а не
// момент времени, и часовой пояс его не сдвигает.
function dayToDate(day: string): Date | null | "invalid" {
  if (!day) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "invalid";
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

export async function createTask(formData: FormData): Promise<ActionResult> {
  const scope = await getScope();

  const title = text(formData, "title").slice(0, 300);
  const note = text(formData, "note").slice(0, 5000);
  const due = dayToDate(text(formData, "day"));
  const rawCandidate = text(formData, "candidateId");

  if (!title) return fail("Напишите, что нужно сделать");
  if (due === "invalid") return fail("Не получилось прочитать дату");

  // Кандидат — только из своей компании и только видимый этому человеку.
  let candidateId: string | null = null;
  if (rawCandidate) {
    const candidate = await db.candidate.findFirst({
      where: {
        id: rawCandidate,
        companyId: scope.companyId,
        ...candidateVisibilityFilter(scope.session.user),
      },
      select: { id: true },
    });
    if (!candidate) return fail("Кандидат не найден");
    candidateId = candidate.id;
  }

  await db.task.create({
    data: {
      companyId: scope.companyId,
      userId: scope.session.user.id,
      title,
      note: note || null,
      dueAt: due,
      candidateId,
    },
  });

  revalidatePath("/notebook");
  if (candidateId) revalidatePath(`/candidates/${candidateId}`);

  return done("Добавлено в блокнот");
}

async function ownTask(scope: Awaited<ReturnType<typeof getScope>>, id: string) {
  return db.task.findFirst({
    where: { id, companyId: scope.companyId, userId: scope.session.user.id },
    select: { id: true, done: true, candidateId: true },
  });
}

export async function toggleTask(formData: FormData): Promise<ActionResult> {
  const scope = await getScope();
  const task = await ownTask(scope, text(formData, "taskId"));
  if (!task) return fail("Запись не найдена");

  await db.task.update({
    where: { id: task.id },
    data: { done: !task.done, doneAt: task.done ? null : new Date() },
  });

  revalidatePath("/notebook");
  if (task.candidateId) revalidatePath(`/candidates/${task.candidateId}`);

  return done();
}

export async function deleteTask(formData: FormData): Promise<ActionResult> {
  const scope = await getScope();
  const task = await ownTask(scope, text(formData, "taskId"));
  if (!task) return fail("Запись не найдена");

  await db.task.delete({ where: { id: task.id } });

  revalidatePath("/notebook");
  if (task.candidateId) revalidatePath(`/candidates/${task.candidateId}`);

  return done("Удалено");
}
