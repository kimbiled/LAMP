import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

// Сессия — это подтверждение того, что человек уже вошёл в систему.
// В браузере хранится только случайный ключ, в базе — его отпечаток.
// Даже если кто-то получит доступ к базе, войти по этим данным он не сможет.

const COOKIE_NAME = "lamp_session";
const SESSION_DAYS = 30;

export type CurrentSession = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    companyId: string;
  };
  company: {
    id: string;
    name: string;
  };
  // Считается тем же запросом, что и сессия: лишнее обращение к базе
  // на каждой странице стоило бы примерно 80 миллисекунд.
  unreadNotifications: number;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  meta?: { userAgent?: string | null; ip?: string | null },
): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta?.userAgent ?? null,
      ip: meta?.ip ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true, // недоступно из кода страницы — защита от кражи ключа
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

// cache() из React: если сессия нужна несколько раз при отрисовке одной
// страницы, запрос к базе выполнится только один раз.
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          company: true,
          _count: { select: { notifications: { where: { isRead: false } } } },
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  // Срок сессии истёк или пользователя заблокировали — доступа нет.
  if (session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role,
      companyId: session.user.companyId,
    },
    company: {
      id: session.user.company.id,
      name: session.user.company.name,
    },
    unreadNotifications: session.user._count.notifications,
  };
});

// Используется на всех защищённых страницах: нет сессии — отправляем на вход.
export async function requireSession(): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  cookieStore.delete(COOKIE_NAME);
}
