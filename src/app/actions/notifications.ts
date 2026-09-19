"use server";

import { revalidatePath } from "next/cache";
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
