import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireScope } from "@/lib/tenant";
import { setUserActive } from "@/app/actions/users";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { RoleSelect } from "./role-select";

export const metadata: Metadata = { title: "Пользователи — LAMP" };

export default async function UsersPage() {
  // Право users.manage есть только у администратора.
  // Остальные получат страницу «не найдено» — даже по прямому адресу.
  const scope = await requireScope("users.manage");

  const users = await db.user.findMany({
    where: { companyId: scope.companyId },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-strong">Пользователи</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Сотрудники компании «{scope.session.company.name}»
          </p>
        </div>

        <Link
          href="/users/new"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Добавить пользователя
        </Link>
      </div>

      <div className="mt-6 divide-y divide-muted overflow-hidden rounded-xl border border-muted bg-surface">
        {users.map((user) => {
          const isSelf = user.id === scope.session.user.id;

          return (
            <div
              key={user.id}
              className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 md:flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-ink">
                    {user.fullName}
                  </p>
                  {isSelf && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-ink-soft">
                      это вы
                    </span>
                  )}
                  {!user.isActive && (
                    <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] text-red-700">
                      заблокирован
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-ink-soft">{user.email}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  Последний вход: {formatDateTime(user.lastLoginAt)}
                </p>
              </div>

              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                {isSelf ? (
                  <span className="rounded-lg bg-muted px-3 py-1.5 text-sm text-ink-soft md:w-48">
                    {ROLE_LABELS[user.role]}
                  </span>
                ) : (
                  <RoleSelect userId={user.id} role={user.role} />
                )}

                {!isSelf && (
                  <form action={setUserActive}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={user.isActive ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-muted px-3 py-1.5 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink md:w-auto"
                    >
                      {user.isActive ? "Заблокировать" : "Разблокировать"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-ink-soft">
        Свою роль изменить нельзя — это защита от потери единственного
        администратора. Заблокированный сотрудник выходит из системы сразу и
        больше не может войти.
      </p>
    </div>
  );
}
