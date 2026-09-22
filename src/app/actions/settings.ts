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

  // Постоянную ссылку на встречу проверяем отдельно: она необязательна,
  // но если указана — должна быть настоящим адресом, иначе кнопка
  // «Вставить ссылку» подставит мусор.
  const meetingLink = text(formData, "meetingLink");

  if (meetingLink && !/^https?:\/\/\S+$/.test(meetingLink)) {
    return {
      fieldErrors: {
        meetingLink: "Ссылка должна начинаться с https:// и быть без пробелов",
      },
    };
  }

  await db.company.update({
    where: { id: scope.companyId },
    data: {
      name: parsed.data.name,
      meetingLink: meetingLink || null,
    },
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

  return { success: "Настройки компании сохранены" };
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

// Имя и должность самого себя.
//
// Должность нужна не для прав, а для фидбэков: читающему важно знать,
// кто это написал — рекрутер или руководитель отдела, куда человека
// нанимают. Роль такого не показывает.
export async function updateOwnProfile(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const scope = await getScope();

  const fullName = text(formData, "fullName").slice(0, 100);
  const position = text(formData, "position").slice(0, 100);

  if (fullName.length < 2) {
    return { fieldErrors: { fullName: "Укажите имя и фамилию" } };
  }

  await db.user.update({
    where: { id: scope.session.user.id },
    data: { fullName, position: position || null },
  });

  revalidatePath("/settings");

  return { success: "Профиль сохранён" };
}
