import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { BackButton } from "@/components/back-button";
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

  // Три запроса одновременно: кандидатов и этапы можно запрашивать,
  // не дожидаясь самой вакансии.
  const [job, stages, candidates] = await Promise.all([
    db.job.findFirst({
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
    }),
    db.stage.findMany({
      where: { companyId: scope.companyId },
      select: { id: true, name: true, key: true },
      orderBy: { position: "asc" },
    }),
    db.candidate.findMany({
      where: {
        companyId: scope.companyId,
        jobId: id,
        // Та же проверка доступа, что и для самой вакансии.
        job: jobVisibilityFilter(scope.session.user),
      },
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

  // Если вакансии нет или она чужая — 404.
  assertOwnCompany(job, scope.companyId);
  if (!job) return null;

  const canManage = scope.can("jobs.manage");

  return (
    <div className="mx-auto max-w-4xl">
      <BackButton fallbackHref="/jobs" fallbackLabel="К списку вакансий" />

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

      {/* Слева боковая панель с кандидатами, справа сама вакансия. */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          {scope.can("candidates.create") && (
            <Link
              href={`/candidates/new?job=${job.id}`}
              className="block rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-ink transition hover:bg-accent-hover"
            >
              Добавить кандидата
            </Link>
          )}

          <CandidatesByStage stages={stages} candidates={candidates} />
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

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

          {!job.description && !job.requirements && (
            <section className="rounded-xl border border-dashed border-muted bg-surface p-8 text-center">
              <p className="text-sm text-ink-soft">
                Описание и требования не заполнены.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
