"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";

// Пометка уведомлений прочитанными.
// Уведомление всегда принадлежит конкретному человеку — чужое
// пометить нельзя, это проверяется по userId из сессии.

export async function markNotificationRead(formData: FormData): Promise<void> {
  const scope = await getScope();
  const id = formData.get("notificationId");

  if (typeof id !== "string") return;

  await db.notification.updateMany({
    where: { id, userId: scope.session.user.id },
    data: { isRead: true },
  });

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead(): Promise<void> {
  const scope = await getScope();

  await db.notification.updateMany({
    where: { userId: scope.session.user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

// Открыть то, о чём уведомление, и сразу считать его прочитанным.
// Раньше это были два разных нажатия: «Открыть кандидата» и «Прочитано».
// Адрес собираем сами из записи в базе, а не берём из формы.
export async function openNotification(formData: FormData): Promise<void> {
  const scope = await getScope();
  const id = formData.get("notificationId");
  if (typeof id !== "string") return;

  const notification = await db.notification.findFirst({
    where: { id, userId: scope.session.user.id },
    select: { id: true, entityType: true, entityId: true },
  });
  if (!notification) return;

  await db.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });

  revalidatePath("/", "layout");

  if (notification.entityType === "Candidate" && notification.entityId) {
    redirect(`/candidates/${notification.entityId}`);
  }
  revalidatePath("/notifications");
}
