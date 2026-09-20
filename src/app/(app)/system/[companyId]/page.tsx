import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/superadmin";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { UserRow } from "./user-row";
import { AddUserForm } from "./add-user-form";
import { DeleteCompanyForm } from "./delete-company-form";

export const metadata: Metadata = { title: "Компания — LAMP" };

export default async function SystemCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const session = await requireOwner();

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { jobs: true, candidates: true, resumes: true } },
      users: {
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          isSuperAdmin: true,
          createdAt: true,
          lastLoginAt: true,
        },
      },
    },
  });

  if (!company) {
    notFound();
  }

  const isOwnCompany = company.id === session.user.companyId;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/system"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />К списку компаний
      </Link>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-ink-strong">
            {company.name}
          </h1>
          {isOwnCompany && (
            <span className="rounded-md bg-accent/25 px-2 py-0.5 text-xs text-ink">
              ваша компания
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Создана {formatDate(company.createdAt)} · {company._count.jobs}{" "}
          вакансий · {company._count.candidates} кандидатов ·{" "}
          {company._count.resumes} резюме
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/system/candidates?company=${company.id}`}
          className="rounded-lg border border-muted px-3 py-1.5 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
        >
          Кандидаты компании
        </Link>
        <Link
          href={`/system/jobs?company=${company.id}`}
          className="rounded-lg border border-muted px-3 py-1.5 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
        >
          Вакансии компании
        </Link>
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border border-muted bg-surface">
        <div className="border-b border-muted px-4 py-3">
          <h2 className="text-sm font-medium text-ink">
            Пользователи · {company.users.length}
          </h2>
        </div>

        <div className="divide-y divide-muted">
          {company.users.map((user) => (
            <UserRow
              key={user.id}
              user={{
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                roleLabel: ROLE_LABELS[user.role],
                isActive: user.isActive,
                isSuperAdmin: user.isSuperAdmin,
                createdText: formatDate(user.createdAt),
                lastLoginText: formatDateTime(user.lastLoginAt),
              }}
              isSelf={user.id === session.user.id}
              isOnlyUser={company.users.length === 1}
            />
          ))}
        </div>
      </section>

      <AddUserForm companyId={company.id} companyName={company.name} />

      {!isOwnCompany && (
        <DeleteCompanyForm
          companyId={company.id}
          companyName={company.name}
          users={company.users.length}
          candidates={company._count.candidates}
        />
      )}

      {isOwnCompany && (
        <p className="mt-5 rounded-xl border border-muted bg-surface p-4 text-xs text-ink-soft">
          Свою собственную компанию удалить отсюда нельзя — вы бы закрыли себе
          вход в систему.
        </p>
      )}
    </div>
  );
}
