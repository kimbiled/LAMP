import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getScope, assertOwnCompany } from "@/lib/tenant";
import { jobVisibilityFilter } from "@/lib/permissions";
import { JobStatusBadge } from "@/components/job-status-badge";
import { formatDate, formatSalary } from "@/lib/format";
import { JobStatusSelect } from "./status-select";
import { CandidatesByStage } from "./candidates-by-stage";

export const metadata: Metadata = { title: "Вакансия — LAMP" };

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await getScope();

  const job = await db.job.findFirst({
    where: {
      id,
      companyId: scope.companyId,
      // Нанимающий менеджер не откроет чужую вакансию даже по прямой ссылке.
      ...jobVisibilityFilter(scope.session.user),
    },
    include: {
      recruiter: { select: { fullName: true } },
      hiringManager: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
      _count: { select: { candidates: true } },
    },
  });

  // Если вакансии нет или она чужая — 404.
  assertOwnCompany(job, scope.companyId);
  if (!job) return null;

  const [stages, candidates] = await Promise.all([
    db.stage.findMany({
      where: { companyId: scope.companyId },
      select: { id: true, name: true, key: true },
      orderBy: { position: "asc" },
    }),
    db.candidate.findMany({
      where: { companyId: scope.companyId, jobId: job.id },
      select: {
        id: true,
        fullName: true,
        currentPosition: true,
        city: true,
        stageId: true,
        stageChangedAt: true,
      },
      orderBy: { stageChangedAt: "desc" },
    }),
  ]);

  const canManage = scope.can("jobs.manage");

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />К списку вакансий
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink-strong">
              {job.title}
            </h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
            {" · создана "}
            {formatDate(job.createdAt)} · {job.createdBy.fullName}
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <JobStatusSelect jobId={job.id} status={job.status} />
            <Link
              href={`/jobs/${job.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-muted px-3 py-2 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.8} />
              Изменить
            </Link>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-muted bg-surface p-4">
          <p className="text-xs text-ink-soft">Рекрутер</p>
          <p className="mt-1 text-sm text-ink">
            {job.recruiter?.fullName ?? "не назначен"}
          </p>
        </div>
        <div className="rounded-xl border border-muted bg-surface p-4">
          <p className="text-xs text-ink-soft">Нанимающий менеджер</p>
          <p className="mt-1 text-sm text-ink">
            {job.hiringManager?.fullName ?? "не назначен"}
          </p>
        </div>
        <div className="rounded-xl border border-muted bg-surface p-4">
          <p className="text-xs text-ink-soft">Кандидатов</p>
          <p className="mt-1 text-sm text-ink">{job._count.candidates}</p>
        </div>
      </div>

      {(job.description || job.requirements) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {job.description && (
            <section className="rounded-xl border border-muted bg-surface p-5">
              <h2 className="text-sm font-medium text-ink">Описание</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">
                {job.description}
              </p>
            </section>
          )}
          {job.requirements && (
            <section className="rounded-xl border border-muted bg-surface p-5">
              <h2 className="text-sm font-medium text-ink">Требования</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">
                {job.requirements}
              </p>
            </section>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-ink">Кандидаты по этапам</h2>
        {scope.can("candidates.create") && (
          <Link
            href={`/candidates/new?job=${job.id}`}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink transition hover:bg-accent-hover"
          >
            Добавить кандидата
          </Link>
        )}
      </div>

      <div className="mt-3">
        <CandidatesByStage stages={stages} candidates={candidates} />
      </div>
    </div>
  );
}
