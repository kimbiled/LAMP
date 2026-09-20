"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/superadmin";
import { hashPassword } from "@/lib/password";
import { logAction } from "@/lib/audit";
import { removeFile } from "@/lib/storage";
import { createUserSchema, fieldErrorsFrom } from "@/lib/validation";
import type { Role } from "@/generated/prisma/enums";

// Действия владельца системы. Каждое начинается с requireOwner():
// проверка идёт на сервере, а не в интерфейсе, поэтому отправить
// такую форму в обход раздела бесполезно.

export type SystemFormState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  okMessage?: string;
};

const ROLES: Role[] = ["ADMIN", "RECRUITER", "HIRING_MANAGER"];

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Записи вроде «кто создал вакансию» ссылаются на пользователя жёстко:
// пока ссылка есть, удалить человека нельзя. Поэтому авторство
// переписываем на другого сотрудника той же компании.
async function reassignAuthorship(
  userId: string,
  companyId: string,
): Promise<string | null> {
  const heir = await db.user.findFirst({
    where: { companyId, id: { not: userId }, isActive: true },
    // Сначала администратор, потом рекрутер — так авторство остаётся
    // у человека, который и так отвечает за эти данные.
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  if (!heir) return null;

  await db.$transaction([
    db.job.updateMany({
      where: { createdById: userId },
      data: { createdById: heir.id },
    }),
    db.candidate.updateMany({
      where: { createdById: userId },
      data: { createdById: heir.id },
    }),
    db.resume.updateMany({
      where: { uploadedById: userId },
      data: { uploadedById: heir.id },
    }),
    db.interview.updateMany({
      where: { createdById: userId },
      data: { createdById: heir.id },
    }),
    db.shareLink.updateMany({
      where: { createdById: userId },
      data: { createdById: heir.id },
    }),
  ]);

  return heir.id;
}

export async function createUserInCompany(
  companyId: string,
  _prevState: SystemFormState,
  formData: FormData,
): Promise<SystemFormState> {
  const session = await requireOwner();

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

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });

  if (!company) {
    return { formError: "Компания не найдена", values };
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
      companyId: company.id,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      passwordHash: hashPassword(parsed.data.password),
      role: parsed.data.role,
    },
  });

  await logAction({
    companyId: company.id,
    userId: session.user.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: created.id,
    meta: { email: created.email, role: created.role, byOwner: true },
  });

  revalidatePath(`/system/${company.id}`);
  return { okMessage: `Пользователь ${created.fullName} добавлен` };
}

export async function deleteUserAnywhere(
  _prevState: SystemFormState,
  formData: FormData,
): Promise<SystemFormState> {
  const session = await requireOwner();
  const userId = text(formData, "userId");

  if (userId === session.user.id) {
    return { formError: "Нельзя удалить собственную учётную запись" };
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, companyId: true },
  });

  if (!target) {
    return { formError: "Пользователь не найден" };
  }

  const others = await db.user.count({
    where: { companyId: target.companyId, id: { not: target.id } },
  });

  if (others === 0) {
    return {
      formError:
        "Это последний человек в компании — вести её будет некому. Удалите компанию целиком.",
    };
  }

  const heirId = await reassignAuthorship(target.id, target.companyId);

  if (!heirId) {
    return {
      formError:
        "Не нашлось активного сотрудника, на которого можно переписать созданные записи. Разблокируйте кого-нибудь в этой компании и повторите.",
    };
  }

  await db.user.delete({ where: { id: target.id } });

  await logAction({
    companyId: target.companyId,
    userId: session.user.id,
    action: "USER_DELETED",
    entityType: "User",
    entityId: target.id,
    meta: { email: target.email, heirId },
  });

  revalidatePath(`/system/${target.companyId}`);
  revalidatePath("/system");
  return { okMessage: `Пользователь ${target.fullName} удалён` };
}

export async function setUserRoleAnywhere(formData: FormData): Promise<void> {
  const session = await requireOwner();

  const userId = text(formData, "userId");
  const role = text(formData, "role");

  if (!ROLES.includes(role as Role) || userId === session.user.id) {
    return;
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, companyId: true },
  });

  if (!target || target.role === role) {
    return;
  }

  await db.user.update({
    where: { id: target.id },
    data: { role: role as Role },
  });

  await logAction({
    companyId: target.companyId,
    userId: session.user.id,
    action: "USER_ROLE_CHANGED",
    entityType: "User",
    entityId: target.id,
    meta: { from: target.role, to: role, byOwner: true },
  });

  revalidatePath(`/system/${target.companyId}`);
}

export async function setUserActiveAnywhere(formData: FormData): Promise<void> {
  const session = await requireOwner();

  const userId = text(formData, "userId");
  const isActive = text(formData, "isActive") === "true";

  if (userId === session.user.id) {
    return;
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, companyId: true },
  });

  if (!target) return;

  await db.user.update({ where: { id: target.id }, data: { isActive } });

  // Блокировка должна действовать сразу, а не через месяц:
  // убираем все открытые сессии человека.
  if (!isActive) {
    await db.session.deleteMany({ where: { userId: target.id } });
  }

  await logAction({
    companyId: target.companyId,
    userId: session.user.id,
    action: isActive ? "USER_UNBLOCKED" : "USER_BLOCKED",
    entityType: "User",
    entityId: target.id,
    meta: { email: target.email, byOwner: true },
  });

  revalidatePath(`/system/${target.companyId}`);
}

export async function setOwnerFlag(formData: FormData): Promise<void> {
  const session = await requireOwner();

  const userId = text(formData, "userId");
  const makeOwner = text(formData, "isSuperAdmin") === "true";

  // Снять права с себя нельзя: иначе можно случайно закрыть себе
  // единственный вход в раздел.
  if (userId === session.user.id) {
    return;
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, companyId: true, isSuperAdmin: true },
  });

  if (!target || target.isSuperAdmin === makeOwner) {
    return;
  }

  await db.user.update({
    where: { id: target.id },
    data: { isSuperAdmin: makeOwner },
  });

  await logAction({
    companyId: target.companyId,
    userId: session.user.id,
    action: makeOwner ? "OWNER_GRANTED" : "OWNER_REVOKED",
    entityType: "User",
    entityId: target.id,
    meta: { email: target.email },
  });

  revalidatePath(`/system/${target.companyId}`);
  revalidatePath("/system");
}

export async function deleteCompany(
  _prevState: SystemFormState,
  formData: FormData,
): Promise<SystemFormState> {
  const session = await requireOwner();

  const companyId = text(formData, "companyId");
  const confirmation = text(formData, "confirmation");

  if (companyId === session.user.companyId) {
    return {
      formError:
        "Это ваша собственная компания — её удаление закрыло бы вам вход. Удалите её из другой учётной записи владельца.",
    };
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, _count: { select: { users: true } } },
  });

  if (!company) {
    return { formError: "Компания не найдена" };
  }

  // Название вводится вручную — защита от случайного нажатия.
  if (confirmation !== company.name) {
    return {
      formError: `Чтобы удалить компанию, введите её название точно: ${company.name}`,
    };
  }

  // Файлы резюме лежат вне базы, каскад их не тронет — убираем сами.
  const resumes = await db.resume.findMany({
    where: { companyId: company.id },
    select: { storageKey: true },
  });

  for (const resume of resumes) {
    try {
      await removeFile(resume.storageKey);
    } catch {
      // Файл мог быть удалён раньше. Это не повод останавливать удаление.
    }
  }

  await db.company.delete({ where: { id: company.id } });

  // Журнал компании удалён вместе с ней, поэтому запись делаем
  // в журнале того, кто удалял.
  await logAction({
    companyId: session.user.companyId,
    userId: session.user.id,
    action: "COMPANY_DELETED",
    entityType: "Company",
    entityId: company.id,
    meta: {
      name: company.name,
      users: company._count.users,
      resumeFiles: resumes.length,
    },
  });

  revalidatePath("/system");

  // Страницы этой компании больше нет — уводим на список компаний,
  // иначе человек увидит «страница не найдена».
  redirect("/system");
}
