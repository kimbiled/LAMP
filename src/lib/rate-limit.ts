import "server-only";
import { db } from "@/lib/db";

// Защита от подбора пароля.
//
// Считаем неудачные попытки входа за последние 15 минут — отдельно
// по почте и отдельно по адресу в сети. Если их слишком много,
// временно перестаём принимать пароль, даже правильный.

const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 8;
const MAX_FAILURES_PER_IP = 20;

export async function recordLoginAttempt(params: {
  email: string;
  ip: string | null;
  success: boolean;
}): Promise<void> {
  await db.loginAttempt.create({
    data: {
      email: params.email.slice(0, 200),
      ip: params.ip,
      success: params.success,
    },
  });
}

export async function isLoginBlocked(params: {
  email: string;
  ip: string | null;
}): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const byEmail = await db.loginAttempt.count({
    where: { email: params.email, success: false, createdAt: { gte: since } },
  });

  if (byEmail >= MAX_FAILURES_PER_EMAIL) {
    return true;
  }

  if (!params.ip) {
    return false;
  }

  const byIp = await db.loginAttempt.count({
    where: { ip: params.ip, success: false, createdAt: { gte: since } },
  });

  return byIp >= MAX_FAILURES_PER_IP;
}

// После удачного входа старые неудачные попытки больше не нужны.
export async function clearLoginAttempts(email: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { email } });
}

export const LOGIN_WINDOW_MINUTES = WINDOW_MINUTES;
