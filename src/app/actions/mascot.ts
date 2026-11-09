"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { lookAllowed, MASCOT_PARTS, readLook, type MascotLook } from "@/lib/mascot";
import { closedThisMonth } from "@/lib/mascot-progress";
import { done, fail, type ActionResult } from "@/lib/action-result";

// Сохранить образ персонажа. Проверяем на сервере, что новые вещи
// действительно открыты: скрыть замок в интерфейсе — не защита.
export async function saveMascot(formData: FormData): Promise<ActionResult> {
  const scope = await getScope();
  const me = scope.session.user;

  const raw: Record<string, string> = {};
  for (const { part } of MASCOT_PARTS) {
    const value = formData.get(part);
    if (typeof value === "string") raw[part] = value;
  }
  const next: MascotLook = readLook(raw);

  const user = await db.user.findUnique({ where: { id: me.id }, select: { mascot: true } });
  const current = readLook(user?.mascot);
  const closed = await closedThisMonth(me.id, scope.companyId);

  if (!lookAllowed(next, current, closed)) {
    return fail("Эта вещь ещё не открыта — закройте больше вакансий в этом месяце");
  }

  await db.user.update({ where: { id: me.id }, data: { mascot: next } });

  revalidatePath("/", "layout");
  return done("Образ сохранён");
}
