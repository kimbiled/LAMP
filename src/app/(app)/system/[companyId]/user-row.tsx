"use client";

import { useActionState, useState, useTransition } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import {
  deleteUserAnywhere,
  setOwnerFlag,
  setUserActiveAnywhere,
  setUserRoleAnywhere,
  type SystemFormState,
} from "@/app/actions/system";
import type { Role } from "@/generated/prisma/enums";

// Строка пользователя в разделе владельца: роль, блокировка,
// права владельца и удаление. Все кнопки отправляют форму на сервер —
// там права проверяются заново.

export type SystemUser = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  roleLabel: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  createdText: string;
  lastLoginText: string;
};

const initialState: SystemFormState = {};

export function UserRow({
  user,
  isSelf,
  isOnlyUser,
}: {
  user: SystemUser;
  isSelf: boolean;
  // Последнего человека компании удалить нельзя: вести её будет некому.
  // Вместо кнопки показываем подсказку, чтобы не упираться в ошибку.
  isOnlyUser: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [state, deleteAction] = useActionState(
    deleteUserAnywhere,
    initialState,
  );

  const send = (
    action: (data: FormData) => void,
    values: [string, string][],
  ) => {
    const formData = new FormData();
    for (const [key, value] of values) formData.set(key, value);
    startTransition(() => action(formData));
  };

  return (
    <div className="p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 md:flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">
              {user.fullName}
            </p>
            {isSelf && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-ink-soft">
                это вы
              </span>
            )}
            {user.isSuperAdmin && (
              <span className="inline-flex items-center gap-1 rounded-md bg-khaki-soft px-1.5 py-0.5 text-xs text-ink">
                <ShieldCheck className="h-3 w-3" strokeWidth={2} />
                владелец системы
              </span>
            )}
            {!user.isActive && (
              <span className="rounded-md bg-danger-soft px-1.5 py-0.5 text-xs text-danger">
                заблокирован
              </span>
            )}
          </div>
          <p className="truncate text-xs text-ink-soft">{user.email}</p>
          <p className="mt-1 text-xs text-ink-soft">
            Добавлен {user.createdText} · последний вход: {user.lastLoginText}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSelf ? (
            <span className="rounded-lg bg-muted px-3 py-1.5 text-sm text-ink-soft">
              {user.roleLabel}
            </span>
          ) : (
            <select
              defaultValue={user.role}
              disabled={pending}
              aria-label={`Роль: ${user.fullName}`}
              onChange={(event) =>
                send(setUserRoleAnywhere, [
                  ["userId", user.id],
                  ["role", event.target.value],
                ])
              }
              className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-ink focus:ring-[3px] focus:ring-accent/40 disabled:opacity-60"
            >
              <option value="ADMIN">Администратор</option>
              <option value="RECRUITER">Рекрутер</option>
              <option value="HIRING_MANAGER">Нанимающий менеджер</option>
            </select>
          )}

          {!isSelf && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  send(setUserActiveAnywhere, [
                    ["userId", user.id],
                    ["isActive", user.isActive ? "false" : "true"],
                  ])
                }
                className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink transition hover:bg-canvas disabled:opacity-60"
              >
                {user.isActive ? "Заблокировать" : "Разблокировать"}
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  send(setOwnerFlag, [
                    ["userId", user.id],
                    ["isSuperAdmin", user.isSuperAdmin ? "false" : "true"],
                  ])
                }
                className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink transition hover:bg-canvas disabled:opacity-60"
              >
                {user.isSuperAdmin ? "Убрать владельца" : "Сделать владельцем"}
              </button>

              {isOnlyUser ? (
                <span className="text-xs text-ink-soft">
                  последний в компании — удаляется вместе с компанией
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming((value) => !value)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition hover:border-danger-line hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Удалить
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {state.formError && (
        <p className="mt-3 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.formError}
        </p>
      )}

      {confirming && !isSelf && (
        <form
          action={deleteAction}
          onSubmit={() => setConfirming(false)}
          className="mt-3 rounded-lg border border-danger-line bg-danger-soft/60 p-3"
        >
          <input type="hidden" name="userId" value={user.id} />
          <p className="text-sm text-ink">
            Удалить {user.fullName} без возможности восстановления? Вакансии,
            кандидаты и резюме компании останутся: авторство перейдёт другому
            сотруднику.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-white transition hover:bg-danger-hover"
            >
              Да, удалить
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink transition hover:bg-canvas"
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
