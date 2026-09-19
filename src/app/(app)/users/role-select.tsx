"use client";

import { useTransition } from "react";
import { changeUserRole } from "@/app/actions/users";
import type { Role } from "@/generated/prisma/enums";

// Выпадающий список роли. Выбор сразу отправляется на сервер,
// отдельной кнопки «Сохранить» не нужно.

export function RoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: Role;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={role}
      disabled={disabled || pending}
      aria-label="Роль пользователя"
      onChange={(event) => {
        const formData = new FormData();
        formData.set("userId", userId);
        formData.set("role", event.target.value);
        startTransition(() => changeUserRole(formData));
      }}
      className="w-full rounded-lg border border-muted bg-surface px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60 md:w-48"
    >
      <option value="ADMIN">Администратор</option>
      <option value="RECRUITER">Рекрутер</option>
      <option value="HIRING_MANAGER">Нанимающий менеджер</option>
    </select>
  );
}
