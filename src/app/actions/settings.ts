"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logAction } from "@/lib/audit";
import {
  companySettingsSchema,
  fieldErrorsFrom,
  isWeakPassword,
} from "@/lib/validation";

export type SettingsFormState = {
  formError?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateCompany(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const scope = await getScope();

  if (!scope.can("company.manage")) {
    return { formError: "Недостаточно прав для этого действия" };
  }

  const parsed = companySettingsSchema.safeParse({
    name: text(formData, "name"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await db.company.update({
    where: { id: scope.companyId },
    data: { name: parsed.data.name },
  });

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: "COMPANY_UPDATED",
    entityType: "Company",
    entityId: scope.companyId,
    meta: { name: parsed.data.name },
  });

  revalidatePath("/", "layout");

  return { success: "Название компании обновлено" };
}

export async function changeOwnPassword(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const scope = await getScope();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const newPasswordConfirm = String(formData.get("newPasswordConfirm") ?? "");

  if (newPassword.length < 8) {
    return {
      fieldErrors: { newPassword: "Пароль должен быть не короче 8 символов" },
    };
  }

  if (isWeakPassword(newPassword)) {
    return {
      fieldErrors: {
        newPassword: "Этот пароль слишком простой — его подбирают первым",
      },
    };
  }

  if (newPassword !== newPasswordConfirm) {
    return { fieldErrors: { newPasswordConfirm: "Пароли не совпадают" } };
  }

  const user = await db.user.findUnique({
    where: { id: scope.session.user.id },
  });

  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return { fieldErrors: { currentPassword: "Текущий пароль неверный" } };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) },
  });

  // Все остальные входы этого человека прекращаются: если пароль меняют
  // из-за подозрения на утечку, чужая сессия не должна остаться активной.
  await db.session.deleteMany({
    where: { userId: user.id, id: { not: scope.session.sessionId } },
  });

  await logAction({
    companyId: scope.companyId,
    userId: user.id,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user.id,
  });

  return { success: "Пароль изменён" };
}
