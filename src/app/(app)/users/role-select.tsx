"use client";

import { changeUserRole } from "@/app/actions/users";
import { InstantSelect } from "@/components/ui/instant-select";
import type { Role } from "@/generated/prisma/enums";

// Роль сотрудника. Сохраняется сразу при выборе, но сначала спрашивает
// подтверждение: роль решает, что человек видит и может менять,
// и случайное нажатие стрелки на клавиатуре не должно её сменить.

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Администратор" },
  { value: "RECRUITER", label: "Рекрутер" },
  { value: "HIRING_MANAGER", label: "Нанимающий менеджер" },
];

export function RoleSelect({
  userId,
  userName,
  role,
  disabled,
}: {
  userId: string;
  userName: string;
  role: Role;
  disabled?: boolean;
}) {
  return (
    <InstantSelect
      value={role}
      options={ROLE_OPTIONS}
      action={changeUserRole}
      buildForm={(next) => ({ userId, role: next })}
      label={`Роль: ${userName}`}
      confirmText={(next) => ({
        title: `Сделать ${userName} — «${next}»?`,
        message: "От роли зависит, что сотрудник видит и может менять в системе.",
      })}
      disabled={disabled}
      className="w-full md:w-56"
    />
  );
}
