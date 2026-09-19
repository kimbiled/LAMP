"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { hashPassword } from "@/lib/password";
import { logAction } from "@/lib/audit";
import { createUserSchema, fieldErrorsFrom } from "@/lib/validation";
import type { Role } from "@/generated/prisma/enums";

export type UserFormState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const ROLES: Role[] = ["ADMIN", "RECRUITER", "HIRING_MANAGER"];

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createUser(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const scope = await getScope();

  // Проверка прав на сервере. Даже если кто-то отправит форму напрямую,
  // минуя интерфейс, без этого права ничего не произойдёт.
  if (!scope.can("users.manage")) {
    return { formError: "Недостаточно прав для этого действия" };
  }

  const input = {
    fullName: text(formData, "fullName"),
    email: text(formData, "email").toLowerCase(),
    password: String(formData.get("password") ?? ""),
    role: text(formData, "role"),
  };

  const values = {
    fullName: input.fullName,
    email: input.email,
    role: input.role,
  };

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const existing = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (existing) {
    return {
      fieldErrors: { email: "Пользователь с такой почтой уже существует" },
      values,
    };
  }

  const created = await db.user.create({
    data: {
      companyId: scope.companyId, // компания берётся из сессии, не из формы
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      passwordHash: hashPassword(parsed.data.password),
      role: parsed.data.role,
    },
  });

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: created.id,
    meta: { email: created.email, role: created.role },
  });

  redirect("/users");
}

export async function changeUserRole(formData: FormData): Promise<void> {
  const scope = await getScope();
  if (!scope.can("users.manage")) {
    return;
  }

  const userId = text(formData, "userId");
  const role = text(formData, "role");

  if (!ROLES.includes(role as Role)) {
    return;
  }

  // Себе роль менять нельзя: иначе администратор способен
  // случайно лишить компанию единственного администратора.
  if (userId === scope.session.user.id) {
    return;
  }

  // findFirst с companyId — пользователь из чужой компании просто не найдётся.
  const target = await db.user.findFirst({
    where: { id: userId, companyId: scope.companyId },
  });

  if (!target || target.role === role) {
    return;
  }

  await db.user.update({
    where: { id: target.id },
    data: { role: role as Role },
  });

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: "USER_ROLE_CHANGED",
    entityType: "User",
    entityId: target.id,
    meta: { from: target.role, to: role },
  });

  revalidatePath("/users");
}

export async function setUserActive(formData: FormData): Promise<void> {
  const scope = await getScope();
  if (!scope.can("users.manage")) {
    return;
  }

  const userId = text(formData, "userId");
  const isActive = text(formData, "isActive") === "true";

  if (userId === scope.session.user.id) {
    return;
  }

  const target = await db.user.findFirst({
    where: { id: userId, companyId: scope.companyId },
  });

  if (!target) {
    return;
  }

  await db.user.update({
    where: { id: target.id },
    data: { isActive },
  });

  // При блокировке удаляем активные сессии: человека выкинет из системы
  // немедленно, а не через 30 дней.
  if (!isActive) {
    await db.session.deleteMany({ where: { userId: target.id } });
  }

  await logAction({
    companyId: scope.companyId,
    userId: scope.session.user.id,
    action: isActive ? "USER_UNBLOCKED" : "USER_BLOCKED",
    entityType: "User",
    entityId: target.id,
    meta: { email: target.email },
  });

  revalidatePath("/users");
}
