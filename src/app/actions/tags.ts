"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";

// Метки кандидата. Создаются на лету: рекрутер пишет «релокант»,
// и если такой метки в компании ещё нет, она заводится.
//
// Метка всегда принадлежит компании из сессии, поэтому чужую
// метку повесить нельзя даже подставив её идентификатор.

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Приводим к одному виду, чтобы «Релокант» и «релокант  »
// не превратились в две разные метки.
function normalizeName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 40);
}

export async function addTag(formData: FormData): Promise<void> {
  const scope = await getScope();
  if (!scope.can("candidates.edit")) {
    return;
  }

  const candidateId = text(formData, "candidateId");
  const name = normalizeName(text(formData, "name"));

  if (!name) return;

  const candidate = await db.candidate.findFirst({
    where: { id: candidateId, companyId: scope.companyId },
    select: { id: true, jobId: true },
  });

  if (!candidate) return;

  // Метка с таким названием в компании может уже быть — тогда
  // берём существующую, а не заводим вторую такую же.
  const tag = await db.tag.upsert({
    where: { companyId_name: { companyId: scope.companyId, name } },
    update: {},
    create: { companyId: scope.companyId, name },
    select: { id: true },
  });

  await db.candidate.update({
    where: { id: candidate.id },
    data: { tags: { connect: { id: tag.id } } },
  });

  revalidatePath(`/candidates/${candidate.id}`);
  revalidatePath("/candidates");
}

export async function removeTag(formData: FormData): Promise<void> {
  const scope = await getScope();
  if (!scope.can("candidates.edit")) {
    return;
  }

  const candidateId = text(formData, "candidateId");
  const tagId = text(formData, "tagId");

  const candidate = await db.candidate.findFirst({
    where: { id: candidateId, companyId: scope.companyId },
    select: { id: true },
  });

  const tag = await db.tag.findFirst({
    where: { id: tagId, companyId: scope.companyId },
    select: { id: true },
  });

  if (!candidate || !tag) return;

  // Саму метку не удаляем: она может висеть на других кандидатах.
  await db.candidate.update({
    where: { id: candidate.id },
    data: { tags: { disconnect: { id: tag.id } } },
  });

  revalidatePath(`/candidates/${candidate.id}`);
  revalidatePath("/candidates");
}
