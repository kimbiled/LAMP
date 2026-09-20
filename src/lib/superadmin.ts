import "server-only";
import { notFound } from "next/navigation";
import { requireSession, type CurrentSession } from "@/lib/session";

// Владелец системы — тот, кто отвечает за LAMP целиком, а не за одну
// компанию. Только он видит раздел «Система»: список всех компаний
// и их пользователей.
//
// Флаг isSuperAdmin нельзя выдать себе через обычный интерфейс.
// Первый владелец назначается командой:
//   npm run grant-owner -- почта@пример.kz
// Дальше он может назначать и снимать владельцев прямо в разделе.

export async function requireOwner(): Promise<CurrentSession> {
  const session = await requireSession();

  // Отвечаем «страница не найдена», а не «нет доступа»: посторонний
  // не должен даже узнать, что такой раздел существует.
  if (!session.user.isSuperAdmin) {
    notFound();
  }

  return session;
}
