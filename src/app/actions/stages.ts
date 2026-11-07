"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { logAction } from "@/lib/audit";
import { done, fail, type ActionResult } from "@/lib/action-result";
import { insertIndexForNewStage, moveInOrder } from "@/lib/stages";

// Конструктор этапов подбора: добавить, переименовать, переставить,
// удалить. Всё — только администратору (право stages.manage) и только
// в пределах своей компании.
//
// Системные этапы (с key) можно переименовывать и переставлять:
// по key строятся цвета и аналитика, а название — дело компании.
// Удалить можно любой этап, но кандидатов с него сначала переводят
// в другой: оставить человека «нигде» нельзя.

const MAX_NAME = 60;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function checkName(name: string): string | null {
  if (name.length < 2) return "Название — хотя бы два символа";
  if (name.length > MAX_NAME) return `Название — не длиннее ${MAX_NAME} символов`;
  return null;
}

async function companyStages(companyId: string) {
  return db.stage.findMany({
    where: { companyId },
    orderBy: { position: "asc" },
    select: { id: true, name: true, key: true },
  });
}

// Позиции всегда 1, 2, 3… без дыр: так номер на экране совпадает
// с порядком, а первый этап однозначно «куда попадают новые».
async function savePositions(ids: string[]) {
  await db.$transaction(
    ids.map((id, index) =>
      db.stage.update({ where: { id }, data: { position: index + 1 } }),
    ),
  );
}

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/candidates");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

function sameName(a: string, b: string) {
  return a.toLocaleLowerCase("ru") === b.toLocaleLowerCase("ru");
}

export async function createStage(formData: FormData): Promise<ActionResult> {
  const scope = await getScope();
  if (!scope.can("stages.manage")) return fail("Недостаточно прав");

  const name = text(formData, "name");
  const problem = checkName(name);
  if (problem) return fail(problem);

  const stages = await companyStages(scope.companyId);
  if (stages.some((stage) => sameName(stage.name, name))) {
    return fail("Такой этап уже есть");
  }

  const created = await db.stage.create({
    data: {
      companyId: scope.companyId,
      name,
      key: null,
      isSystem: false,
      position: stages.length + 1,
    },
    select: { id: true },
  });

  const ids = stages.map((stage) => stage.id);
  ids.splice(insertIndexForNewStage(stages), 0, created.id);
  await savePositions(ids);

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: "STAGE_CREATED",
    entityType: "Stage",
    entityId: created.id,
    meta: { name },
  });

  refresh();
  return done(`Этап «${name}» добавлен`);
}

export async function renameStage(formData: FormData): Promise<ActionResult> {
  const scope = await getScope();
  if (!scope.can("stages.manage")) return fail("Недостаточно прав");

  const stageId = text(formData, "stageId");
  const name = text(formData, "name");
  const problem = checkName(name);
  if (problem) return fail(problem);

  const stages = await companyStages(scope.companyId);
  const stage = stages.find((item) => item.id === stageId);
  if (!stage) return fail("Этап не найден");
  if (stage.name === name) return done();

  if (stages.some((item) => item.id !== stageId && sameName(item.name, name))) {
    return fail("Такой этап уже есть");
  }

  await db.stage.update({ where: { id: stage.id }, data: { name } });

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: "STAGE_RENAMED",
    entityType: "Stage",
    entityId: stage.id,
    meta: { from: stage.name, to: name },
  });

  refresh();
  return done("Название сохранено");
}

export async function moveStage(formData: FormData): Promise<ActionResult> {
  const scope = await getScope();
  if (!scope.can("stages.manage")) return fail("Недостаточно прав");

  const stageId = text(formData, "stageId");
  const direction = text(formData, "direction");
  if (direction !== "up" && direction !== "down") return fail("Неизвестное направление");

  const stages = await companyStages(scope.companyId);
  const order = moveInOrder(
    stages.map((stage) => stage.id),
    stageId,
    direction,
  );
  if (!order) return done();

  await savePositions(order);

  refresh();
  return done();
}

export async function deleteStage(formData: FormData): Promise<ActionResult> {
  const scope = await getScope();
  if (!scope.can("stages.manage")) return fail("Недостаточно прав");

  const stageId = text(formData, "stageId");
  const moveToId = text(formData, "moveToStageId");

  const stages = await companyStages(scope.companyId);
  const stage = stages.find((item) => item.id === stageId);
  if (!stage) return fail("Этап не найден");
  if (stages.length <= 2) {
    return fail("Должно остаться хотя бы два этапа");
  }

  const candidates = await db.candidate.findMany({
    where: { companyId: scope.companyId, stageId: stage.id },
    select: { id: true },
  });

  // Кандидатов переводим только в этап своей же компании.
  const target = stages.find((item) => item.id === moveToId && item.id !== stage.id);
  if (candidates.length > 0 && !target) {
    return fail("Выберите, в какой этап перевести кандидатов");
  }

  if (candidates.length > 0 && target) {
    await db.$transaction([
      db.candidate.updateMany({
        where: { companyId: scope.companyId, stageId: stage.id },
        data: { stageId: target.id, stageChangedAt: new Date() },
      }),
      db.candidateHistory.createMany({
        data: candidates.map((candidate) => ({
          companyId: scope.companyId,
          candidateId: candidate.id,
          type: "STAGE_CHANGED" as const,
          fromStageId: stage.id,
          toStageId: target.id,
          comment: `Этап «${stage.name}» удалён из настроек`,
          actorId: scope.session.user.id,
          actorName: scope.session.user.fullName,
        })),
      }),
    ]);
  }

  await db.stage.delete({ where: { id: stage.id } });
  await savePositions(stages.filter((item) => item.id !== stage.id).map((item) => item.id));

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: "STAGE_DELETED",
    entityType: "Stage",
    entityId: stage.id,
    meta: {
      name: stage.name,
      key: stage.key,
      movedCandidates: candidates.length,
      movedTo: target?.name ?? null,
    },
  });

  refresh();
  return done(
    candidates.length > 0 && target
      ? `Этап удалён, кандидаты (${candidates.length}) переведены в «${target.name}»`
      : "Этап удалён",
  );
}
