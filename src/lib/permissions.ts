import type { Role } from "@/generated/prisma/enums";

// Правила доступа в одном месте.
// Слева — роль, справа — что ей разрешено. Больше нигде в проекте
// нет решений вида «если администратор, то…»: всё берётся отсюда.

export type Permission =
  | "company.manage" // менять настройки компании
  | "users.manage" // создавать пользователей, менять роли, блокировать
  | "stages.manage" // управлять этапами подбора
  | "jobs.manage" // создавать и редактировать вакансии
  | "jobs.viewAll" // видеть все вакансии компании, а не только свои
  | "candidates.create"
  | "candidates.edit"
  | "candidates.delete"
  | "candidates.viewAll" // видеть всех кандидатов компании
  | "candidates.move" // перемещать между этапами
  | "interviews.manage" // назначать интервью
  | "feedback.create"
  | "share.create" // создавать ссылки «Поделиться»
  | "analytics.view";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "company.manage",
    "users.manage",
    "stages.manage",
    "jobs.manage",
    "jobs.viewAll",
    "candidates.create",
    "candidates.edit",
    "candidates.delete",
    "candidates.viewAll",
    "candidates.move",
    "interviews.manage",
    "feedback.create",
    "share.create",
    "analytics.view",
  ],
  RECRUITER: [
    "jobs.manage",
    "jobs.viewAll",
    "candidates.create",
    "candidates.edit",
    "candidates.viewAll",
    "candidates.move",
    "interviews.manage",
    "feedback.create",
    "share.create",
    "analytics.view",
  ],
  // Нанимающий менеджер видит только назначенные ему вакансии и кандидатов.
  // Это ограничение задаётся не списком прав, а фильтром запросов ниже.
  HIRING_MANAGER: ["feedback.create"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

// Фильтр «какие вакансии человек вправе видеть».
// Администратор и рекрутер — все вакансии компании.
// Нанимающий менеджер — только те, где он назначен.
export function jobVisibilityFilter(user: { id: string; role: Role }) {
  if (can(user.role, "jobs.viewAll")) {
    return {};
  }
  return { hiringManagerId: user.id };
}

// То же самое для кандидатов: они видны через свою вакансию.
export function candidateVisibilityFilter(user: { id: string; role: Role }) {
  if (can(user.role, "candidates.viewAll")) {
    return {};
  }
  return { job: { hiringManagerId: user.id } };
}
