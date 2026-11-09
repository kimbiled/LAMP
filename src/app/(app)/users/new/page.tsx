import type { Metadata } from "next";
import { requireScope } from "@/lib/tenant";
import { NewUserForm } from "./new-user-form";

export const metadata: Metadata = { title: "Новый пользователь — Skillo" };

export default async function NewUserPage() {
  await requireScope("users.manage");

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold text-ink-strong">
        Новый пользователь
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Сотрудник получит доступ к рабочему пространству вашей компании
      </p>

      <div className="mt-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
        <NewUserForm />
      </div>

      <p className="mt-4 text-xs text-ink-soft">
        Приглашения по почте появятся позже: пока вы задаёте пароль сами и
        передаёте его сотруднику. Он сможет сменить его в разделе «Настройки».
      </p>
    </div>
  );
}
