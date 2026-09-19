"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, getSession } from "@/lib/session";
import { DEFAULT_STAGES } from "@/lib/stages";
import { logAction } from "@/lib/audit";
import { fieldErrorsFrom, loginSchema, registerSchema } from "@/lib/validation";
import {
  LOGIN_WINDOW_MINUTES,
  clearLoginAttempts,
  isLoginBlocked,
  recordLoginAttempt,
} from "@/lib/rate-limit";

// Серверные действия: код, который выполняется на сервере,
// когда пользователь отправляет форму.

export type AuthFormState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function requestMeta() {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  return {
    userAgent: headerList.get("user-agent"),
    ip: forwardedFor ? forwardedFor.split(",")[0].trim() : null,
  };
}

export async function registerCompany(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const input = {
    companyName: text(formData, "companyName"),
    fullName: text(formData, "fullName"),
    email: text(formData, "email").toLowerCase(),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
  };

  // Что вернуть в форму, если проверка не прошла — чтобы человек
  // не вводил всё заново. Пароли обратно не отправляем.
  const values = {
    companyName: input.companyName,
    fullName: input.fullName,
    email: input.email,
  };

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const existing = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (existing) {
    return {
      fieldErrors: { email: "Пользователь с такой почтой уже зарегистрирован" },
      values,
    };
  }

  const passwordHash = hashPassword(parsed.data.password);

  // Транзакция: либо создаётся всё сразу, либо ничего.
  // Не бывает компании без администратора или без этапов.
  const user = await db.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: parsed.data.companyName },
    });

    const createdUser = await tx.user.create({
      data: {
        companyId: company.id,
        email: parsed.data.email,
        passwordHash,
        fullName: parsed.data.fullName,
        role: "ADMIN", // первый пользователь всегда администратор
      },
    });

    await tx.stage.createMany({
      data: DEFAULT_STAGES.map((stage, index) => ({
        companyId: company.id,
        name: stage.name,
        key: stage.key,
        position: index + 1,
        isSystem: true,
      })),
    });

    return createdUser;
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "COMPANY_REGISTERED",
    entityType: "Company",
    entityId: user.companyId,
    meta: { companyName: parsed.data.companyName },
  });

  await createSession(user.id, await requestMeta());

  // redirect всегда в самом конце: он прерывает выполнение функции.
  redirect("/dashboard");
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const input = {
    email: text(formData, "email").toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };

  const values = { email: input.email };

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const meta = await requestMeta();

  // Слишком много неудачных попыток — пауза, даже если пароль верный.
  if (await isLoginBlocked({ email: parsed.data.email, ip: meta.ip })) {
    return {
      formError: `Слишком много попыток входа. Попробуйте через ${LOGIN_WINDOW_MINUTES} минут.`,
      values,
    };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
  });

  // Одинаковый текст ошибки и для неверной почты, и для неверного пароля:
  // иначе по ответу можно было бы узнать, кто зарегистрирован в системе.
  const invalid: AuthFormState = {
    formError: "Неверная почта или пароль",
    values,
  };

  if (!user) {
    await recordLoginAttempt({
      email: parsed.data.email,
      ip: meta.ip,
      success: false,
    });
    return invalid;
  }

  if (!verifyPassword(parsed.data.password, user.passwordHash)) {
    await recordLoginAttempt({
      email: parsed.data.email,
      ip: meta.ip,
      success: false,
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      action: "USER_LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
    });
    return invalid;
  }

  if (!user.isActive) {
    return {
      formError: "Доступ заблокирован. Обратитесь к администратору компании.",
      values,
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await clearLoginAttempts(parsed.data.email);

  // Заодно подчищаем просроченные сессии этого человека.
  await db.session.deleteMany({
    where: { userId: user.id, expiresAt: { lt: new Date() } },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "USER_LOGIN",
    entityType: "User",
    entityId: user.id,
  });

  await createSession(user.id, meta);

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const session = await getSession();

  if (session) {
    await logAction({
      companyId: session.company.id,
      userId: session.user.id,
      action: "USER_LOGOUT",
    });
  }

  await destroySession();
  redirect("/login");
}
