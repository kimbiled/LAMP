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
    // Владелец системы — см. src/lib/superadmin.ts.
    isSuperAdmin: boolean;
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

  // Одним запросом, а не через include.
  //
  // Сессия читается на КАЖДОЙ странице, поэтому её цена — это цена
  // всей системы. Prisma на вложенных include раскладывает это на три
  // отдельных обращения к базе: сессия, компания, счётчик уведомлений.
  // База во Франкфурте, каждое обращение — около 85 мс, итого 267 мс
  // впустую на каждом переходе. Одним запросом получается 85 мс.
  //
  // Подстановка $1 делается драйвером, а не склейкой строк, поэтому
  // подобрать токен через содержимое cookie невозможно.
  const rows = await db.$queryRaw<
    {
      sessionId: string;
      expiresAt: Date;
      userId: string;
      email: string;
      fullName: string;
      role: Role;
      companyId: string;
      isActive: boolean;
      isSuperAdmin: boolean;
      companyName: string;
      unread: bigint;
    }[]
  >`
    SELECT
      s."id"           AS "sessionId",
      s."expiresAt"    AS "expiresAt",
      u."id"           AS "userId",
      u."email"        AS "email",
      u."fullName"     AS "fullName",
      u."role"         AS "role",
      u."companyId"    AS "companyId",
      u."isActive"     AS "isActive",
      u."isSuperAdmin" AS "isSuperAdmin",
      c."name"         AS "companyName",
      (
        SELECT COUNT(*) FROM "Notification" n
        WHERE n."userId" = u."id" AND n."isRead" = false
      )                AS "unread"
    FROM "Session" s
    JOIN "User" u ON u."id" = s."userId"
    JOIN "Company" c ON c."id" = u."companyId"
    WHERE s."tokenHash" = ${hashToken(token)}
    LIMIT 1
  `;

  const session = rows[0];
  if (!session) {
    return null;
  }

  // Срок сессии истёк или пользователя заблокировали — доступа нет.
  if (session.expiresAt < new Date() || !session.isActive) {
    return null;
  }

  return {
    sessionId: session.sessionId,
    user: {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role,
      companyId: session.companyId,
      isSuperAdmin: session.isSuperAdmin,
    },
    company: {
      id: session.companyId,
      name: session.companyName,
    },
    // COUNT в Postgres возвращает большое целое, приводим к обычному числу.
    unreadNotifications: Number(session.unread),
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
