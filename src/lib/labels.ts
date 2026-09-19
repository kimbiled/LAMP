import type { Role } from "@/generated/prisma/enums";

// Человеческие названия для значений, которые в базе хранятся по-английски.

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Администратор",
  RECRUITER: "Рекрутер",
  HIRING_MANAGER: "Нанимающий менеджер",
};
