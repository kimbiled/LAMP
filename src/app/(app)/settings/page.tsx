import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { ROLE_LABELS } from "@/lib/labels";
import {
  CompanyForm,
  InviteTemplateForm,
  PasswordForm,
  ProfileForm,
  WorkForm,
} from "./settings-forms";
import { StageEditor } from "./stage-editor";

export const metadata: Metadata = { title: "Настройки — Skillo" };

export default async function SettingsPage() {
  // Сюда пускаем всех вошедших, но блоки внутри показываем по правам.
  const scope = await getScope();
  const canManageCompany = scope.can("company.manage");
  const canManageStages = scope.can("stages.manage");

  // Должность в сессии не лежит: она нужна редко, а сессия читается
  // на каждой странице.
  const company = await db.company.findUnique({
    where: { id: scope.companyId },
    select: {
      meetingLink: true,
      staleDays: true,
      inviteTemplate: true,
      officeAddress: true,
      officeRoom: true,
    },
  });

  const profile = await db.user.findUnique({
    where: { id: scope.session.user.id },
    select: {
      position: true,
      meetingLink: true,
      staleDays: true,
    },
  });

  const stages = canManageStages
    ? await db.stage.findMany({
        where: { companyId: scope.companyId },
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          key: true,
          _count: { select: { candidates: true } },
        },
      })
    : [];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-strong">Настройки</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {scope.session.user.fullName} · {ROLE_LABELS[scope.session.user.role]}
        </p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-ink-strong">
          Ваш профиль
        </h2>
        <ProfileForm
          fullName={scope.session.user.fullName}
          position={profile?.position ?? ""}
        />
      </section>

      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold text-ink-strong">
          Мои встречи
        </h2>
        <p className="mt-1 mb-4 text-xs text-ink-soft">
          Ваша постоянная комната Google Meet для интервью.
        </p>
        <WorkForm
          meetingLink={profile?.meetingLink ?? ""}
          staleDays={profile?.staleDays ?? null}
          companyStaleDays={company?.staleDays ?? 14}
          showStaleDays={scope.session.user.role === "RECRUITER"}
        />
      </section>

      {/* Шаблон общий для компании: им пользуются и администратор,
          и рекрутеры. Нанимающий менеджер приглашений не рассылает. */}
      {(scope.session.user.role === "ADMIN" || scope.session.user.role === "RECRUITER") && (
        <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-ink-strong">
            Шаблон приглашения на интервью
          </h2>
          <p className="mt-1 mb-4 text-xs text-ink-soft">
            Общий для всей компании. Изменения сразу видны у всех рекрутеров.
          </p>
          <InviteTemplateForm
            inviteTemplate={company?.inviteTemplate ?? ""}
            officeAddress={company?.officeAddress ?? ""}
            officeRoom={company?.officeRoom ?? ""}
          />
        </section>
      )}

      {canManageCompany && (
        <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-ink-strong">
            Компания
          </h2>
          <CompanyForm
            name={scope.session.company.name}
            meetingLink={company?.meetingLink ?? ""}
            staleDays={company?.staleDays ?? 14}
          />
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-ink-strong">
          Смена пароля
        </h2>
        <PasswordForm />
      </section>

      {canManageStages && (
        <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-ink-strong">
            Этапы подбора
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            По этим этапам кандидаты движутся на доске каждой вакансии.
            Название можно поправить прямо в строке, порядок — стрелками.
          </p>

          <StageEditor
            stages={stages.map((stage) => ({
              id: stage.id,
              name: stage.name,
              key: stage.key,
              candidateCount: stage._count.candidates,
            }))}
          />
        </section>
      )}
    </div>
  );
}
