import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { ROLE_LABELS } from "@/lib/labels";
import { CompanyForm, PasswordForm, ProfileForm } from "./settings-forms";

export const metadata: Metadata = { title: "Настройки — LAMP" };

export default async function SettingsPage() {
  // Сюда пускаем всех вошедших, но блоки внутри показываем по правам.
  const scope = await getScope();
  const canManageCompany = scope.can("company.manage");

  // Должность в сессии не лежит: она нужна редко, а сессия читается
  // на каждой странице.
  const company = canManageCompany
    ? await db.company.findUnique({
        where: { id: scope.companyId },
        select: { meetingLink: true },
      })
    : null;

  const profile = await db.user.findUnique({
    where: { id: scope.session.user.id },
    select: { position: true },
  });

  const stages = canManageCompany
    ? await db.stage.findMany({
        where: { companyId: scope.companyId },
        orderBy: { position: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-strong">Настройки</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {scope.session.user.fullName} · {ROLE_LABELS[scope.session.user.role]}
        </p>
      </div>

      <section className="rounded-xl border border-muted bg-surface p-6">
        <h2 className="mb-4 text-sm font-medium text-ink">Ваш профиль</h2>
        <ProfileForm
          fullName={scope.session.user.fullName}
          position={profile?.position ?? ""}
        />
      </section>

      {canManageCompany && (
        <section className="rounded-xl border border-muted bg-surface p-6">
          <h2 className="mb-4 text-sm font-medium text-ink">Компания</h2>
          <CompanyForm
            name={scope.session.company.name}
            meetingLink={company?.meetingLink ?? ""}
          />
        </section>
      )}

      <section className="rounded-xl border border-muted bg-surface p-6">
        <h2 className="mb-4 text-sm font-medium text-ink">Смена пароля</h2>
        <PasswordForm />
      </section>

      {canManageCompany && (
        <section className="rounded-xl border border-muted bg-surface p-6">
          <h2 className="text-sm font-medium text-ink">Этапы подбора</h2>
          <p className="mt-1 text-xs text-ink-soft">
            По этим этапам движутся кандидаты на Kanban-доске. Создание
            собственных этапов появится позже.
          </p>

          <ol className="mt-4 space-y-2">
            {stages.map((stage) => (
              <li
                key={stage.id}
                className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-medium text-ink">
                  {stage.position}
                </span>
                <span className="text-sm text-ink">{stage.name}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
