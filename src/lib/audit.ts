import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

// Журнал важных действий: кто, что и когда сделал.
// Требование безопасности из технического задания (пункт 19).

export type AuditAction =
  | "COMPANY_REGISTERED"
  | "USER_LOGIN"
  | "USER_LOGIN_FAILED"
  | "USER_LOGOUT";

export async function logAction(params: {
  companyId: string;
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

  await db.auditLog.create({
    data: {
      companyId: params.companyId,
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      meta: params.meta ?? undefined,
      ip,
    },
  });
}
