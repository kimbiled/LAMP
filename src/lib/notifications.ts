import "server-only";
import { db } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma/enums";

// Внутренние уведомления. Никакой почты и мессенджеров:
// человек видит их внутри системы, на колокольчике в шапке.

export async function notify(params: {
  companyId: string;
  userIds: (string | null | undefined)[];
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  // Себе уведомления не шлём: человек и так знает, что он сделал.
  const recipients = [
    ...new Set(
      params.userIds.filter(
        (id): id is string => Boolean(id) && id !== params.actorId,
      ),
    ),
  ];

  if (recipients.length === 0) {
    return;
  }

  await db.notification.createMany({
    data: recipients.map((userId) => ({
      companyId: params.companyId,
      userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
    })),
  });
}

// Кому сообщать о событиях по кандидату: рекрутеру вакансии
// и назначенному нанимающему менеджеру.
export async function jobWatchers(
  jobId: string | null,
): Promise<(string | null)[]> {
  if (!jobId) return [];

  const job = await db.job.findUnique({
    where: { id: jobId },
    select: { recruiterId: true, hiringManagerId: true },
  });

  return [job?.recruiterId ?? null, job?.hiringManagerId ?? null];
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, isRead: false } });
}
