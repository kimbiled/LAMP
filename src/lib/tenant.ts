import "server-only";
import { notFound } from "next/navigation";
import { requireSession, type CurrentSession } from "@/lib/session";
import { can, type Permission } from "@/lib/permissions";

// «Охрана данных». Каждая страница и каждое действие начинается отсюда.
// Отсюда берётся companyId — из проверенной сессии, а не из адреса
// страницы и не из скрытого поля формы. Подменить его снаружи невозможно.

export type Scope = {
  session: CurrentSession;
  companyId: string;
  can: (permission: Permission) => boolean;
};

export async function getScope(): Promise<Scope> {
  const session = await requireSession();

  return {
    session,
    companyId: session.user.companyId,
    can: (permission: Permission) => can(session.user.role, permission),
  };
}

// Для страниц, куда нельзя без конкретного права.
// Отвечаем «страница не найдена», а не «доступ запрещён»:
// так посторонний не узнает даже о существовании раздела.
export async function requireScope(permission: Permission): Promise<Scope> {
  const scope = await getScope();
  if (!scope.can(permission)) {
    notFound();
  }
  return scope;
}

// Последний рубеж: запись из базы обязана принадлежать вашей компании.
// Если кто-то подставит чужой идентификатор в адрес — получит 404.
export function assertOwnCompany<T extends { companyId: string }>(
  record: T | null | undefined,
  companyId: string,
): T {
  if (!record || record.companyId !== companyId) {
    notFound();
  }
  return record;
}
