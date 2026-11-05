import type { Metadata } from "next";
import Link from "next/link";

import { BackButton } from "@/components/back-button";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/superadmin";
import { JobStatusBadge } from "@/components/job-status-badge";
import { formatDate, formatSalary } from "@/lib/format";

export const metadata: Metadata = { title: "Все вакансии — LAMP" };

export default async function SystemJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  await requireOwner();
  const filters = await searchParams;

  const [companies, jobs] = await Promise.all([
    db.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.job.findMany({
      where: filters.company ? { companyId: filters.company } : {},
      include: {
        company: { select: { id: true, name: true } },
        recruiter: { select: { fullName: true } },
        hiringManager: { select: { fullName: true } },
        _count: { select: { candidates: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 300,
    }),
  ]);

  return (
    <div>
      <BackButton fallbackHref="/system" fallbackLabel="К разделу «Система»" />

      <h1 className="mt-4 text-xl font-semibold text-ink-strong">
        Все вакансии
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Вакансии всех компаний LAMP. Всего: {jobs.length}
      </p>

      <form className="mt-5 flex flex-wrap gap-3">
        <select
          name="company"
          defaultValue={filters.company ?? ""}
          aria-label="Компания"
          className="rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-accent"
        >
          <option value="">Все компании</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="rounded-lg border border-line-strong px-4 py-2.5 text-sm text-ink transition hover:bg-canvas"
        >
          Показать
        </button>
      </form>

      {jobs.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="text-sm text-ink-soft">Вакансий нет.</p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/system/candidates?company=${job.companyId}`}
              className="block p-4 transition hover:bg-canvas"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">{job.title}</p>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-ink-soft">
                  {job.company.name}
                </span>
                <JobStatusBadge status={job.status} />
              </div>

              <p className="mt-1 text-xs text-ink-soft">
                {formatSalary(job.salaryMin, job.salaryMax, job.currency)} ·
                создана {formatDate(job.createdAt)} · кандидатов:{" "}
                {job._count.candidates}
              </p>
              <p className="text-xs text-ink-soft">
                Рекрутер: {job.recruiter?.fullName ?? "не назначен"} · менеджер:{" "}
                {job.hiringManager?.fullName ?? "не назначен"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
