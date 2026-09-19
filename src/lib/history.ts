import "server-only";
import { db } from "@/lib/db";
import type { HistoryType } from "@/generated/prisma/enums";

// История кандидата: кто, что и когда сделал.
// Записи добавляются только отсюда, чтобы формат был одинаковым.

export async function addHistory(params: {
  companyId: string;
  candidateId: string;
  type: HistoryType;
  fromStageId?: string | null;
  toStageId?: string | null;
  comment?: string | null;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<void> {
  await db.candidateHistory.create({
    data: {
      companyId: params.companyId,
      candidateId: params.candidateId,
      type: params.type,
      fromStageId: params.fromStageId ?? null,
      toStageId: params.toStageId ?? null,
      comment: params.comment ?? null,
      actorId: params.actorId ?? null,
      actorName: params.actorName ?? null,
    },
  });
}
