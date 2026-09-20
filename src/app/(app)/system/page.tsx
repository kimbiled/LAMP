import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/superadmin";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Система — LAMP" };

export default async function SystemPage() {
  // Раздел виден только владельцу системы. Остальные — включая
  // администраторов компаний — получат «страница не найдена».
  const session = await requireOwner();

  const [companies, owners] = await Promise.all([
    db.company.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { users: true, jobs: true, candidates: true } },
      },
    }),
    db.user.findMany({
      where: { isSuperAdmin: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        company: { select: { id: true, name: true } },
      },
    }),
  ]);

  const totals = companies.reduce(
    (sum, company) => ({
      users: sum.users + company._count.users,
      jobs: sum.jobs + company._count.jobs,
      candidates: sum.candidates + company._count.candidates,
    }),
    { users: 0, jobs: 0, candidates: 0 },
  );

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold text-ink-strong">Система</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Все компании LAMP. Этот раздел видите только вы и другие владельцы
        системы.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Компаний", value: companies.length },
          { label: "Пользователей", value: totals.users },
          { label: "Вакансий", value: totals.jobs },
          { label: "Кандидатов", value: totals.candidates },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-muted bg-surface p-4"
          >
            <p className="text-2xl font-semibold text-ink-strong">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-ink-soft">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link
          href="/system/candidates"
          className="rounded-xl border border-muted bg-surface p-4 transition hover:border-ink-soft"
        >
          <p className="text-sm font-medium text-ink">Все кандидаты</p>
          <p className="mt-1 text-xs text-ink-soft">
            Единая база по всем компаниям: карточки, резюме, интервью,
            фидбэки и история.
          </p>
        </Link>

        <Link
          href="/system/jobs"
          className="rounded-xl border border-muted bg-surface p-4 transition hover:border-ink-soft"
        >
          <p className="text-sm font-medium text-ink">Все вакансии</p>
          <p className="mt-1 text-xs text-ink-soft">
            Вакансии всех компаний с рекрутерами и числом кандидатов.
          </p>
        </Link>
      </div>

      <h2 className="mt-6 text-sm font-medium text-ink">Компании</h2>

      <div className="mt-3 divide-y divide-muted overflow-hidden rounded-xl border border-muted bg-surface">
        {companies.map((company) => {
          const isOwn = company.id === session.user.companyId;

          return (
            <Link
              key={company.id}
              href={`/system/${company.id}`}
              className="flex items-center gap-3 p-4 transition hover:bg-canvas"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-soft">
                <Building2 className="h-4 w-4" strokeWidth={1.8} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-ink">
                    {company.name}
                  </p>
                  {isOwn && (
                    <span className="rounded-md bg-accent/25 px-1.5 py-0.5 text-[11px] text-ink">
                      ваша компания
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-ink-soft">
                  {company._count.users} польз. · {company._count.jobs} вак. ·{" "}
                  {company._count.candidates} канд. · создана{" "}
                  {formatDate(company.createdAt)}
                </p>
              </div>

              <ChevronRight
                className="h-4 w-4 shrink-0 text-ink-soft"
                strokeWidth={1.8}
              />
            </Link>
          );
        })}
      </div>

      <section className="mt-5 rounded-xl border border-muted bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">Владельцы системы</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Полный доступ ко всем компаниям. Назначаются на странице компании
          кнопкой «Сделать владельцем».
        </p>

        <ul className="mt-3 space-y-2">
          {owners.map((owner) => (
            <li
              key={owner.id}
              className="rounded-lg border border-muted bg-canvas px-3 py-2"
            >
              <p className="text-sm text-ink">
                {owner.fullName}
                {owner.id === session.user.id && (
                  <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-ink-soft">
                    это вы
                  </span>
                )}
              </p>
              <p className="text-xs text-ink-soft">
                {owner.email} · {owner.company.name}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
