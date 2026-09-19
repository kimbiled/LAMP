import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { jobVisibilityFilter } from "@/lib/permissions";
import { JobStatusBadge } from "@/components/job-status-badge";
import { formatDate, formatSalary } from "@/lib/format";
import type { JobStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Вакансии — LAMP" };

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Все" },
  { value: "OPEN", label: "Открытые" },
  { value: "PAUSED", label: "Приостановленные" },
  { value: "CLOSED", label: "Закрытые" },
];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const scope = await getScope();
  const { status } = await searchParams;

  const activeFilter = FILTERS.some((f) => f.value === status && f.value !== "")
    ? (status as JobStatus)
    : null;

  const jobs = await db.job.findMany({
    where: {
      companyId: scope.companyId,
      // Нанимающий менеджер видит только назначенные ему вакансии.
      ...jobVisibilityFilter(scope.session.user),
      ...(activeFilter ? { status: activeFilter } : {}),
    },
    include: {
      recruiter: { select: { fullName: true } },
      hiringManager: { select: { fullName: true } },
      _count: { select: { candidates: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const canManage = scope.can("jobs.manage");

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-strong">Вакансии</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {jobs.length > 0
              ? `Всего: ${jobs.length}`
              : "Пока ни одной вакансии"}
          </p>
        </div>

        {canManage && (
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Создать вакансию
          </Link>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const isActive = (status ?? "") === filter.value;
          return (
            <Link
              key={filter.label}
              href={filter.value ? `/jobs?status=${filter.value}` : "/jobs"}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                isActive
                  ? "bg-ink-strong text-canvas"
                  : "bg-muted text-ink-soft hover:text-ink"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {jobs.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-muted bg-surface p-10 text-center">
          <p className="text-sm text-ink-soft">
            {canManage
              ? "Создайте первую вакансию — после этого можно будет добавлять кандидатов."
              : "Вам пока не назначено ни одной вакансии."}
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-muted overflow-hidden rounded-xl border border-muted bg-surface">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex flex-col gap-3 p-4 transition hover:bg-canvas md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 md:flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-ink">
                    {job.title}
                  </p>
                  <JobStatusBadge status={job.status} />
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
                  {" · создана "}
                  {formatDate(job.createdAt)}
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Рекрутер: {job.recruiter?.fullName ?? "не назначен"}
                  {" · менеджер: "}
                  {job.hiringManager?.fullName ?? "не назначен"}
                </p>
              </div>

              <div className="shrink-0 text-left md:text-right">
                <p className="text-lg font-semibold text-ink-strong">
                  {job._count.candidates}
                </p>
                <p className="text-xs text-ink-soft">кандидатов</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
