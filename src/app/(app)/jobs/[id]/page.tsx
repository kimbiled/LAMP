import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { db } from "@/lib/db";
import { getScope, assertOwnCompany } from "@/lib/tenant";
import { jobVisibilityFilter } from "@/lib/permissions";
import { JobStatusBadge } from "@/components/job-status-badge";
import { formatDate, formatSalary } from "@/lib/format";
import { stageTone } from "@/lib/stages";
import { todayLocal, daysBetween } from "@/lib/time";
import { placeInDay } from "@/lib/calendar";
import { JobStatusSelect } from "./status-select";
import { JobCandidates } from "./job-candidates";

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

  // Сколько дней человек стоит на этапе, считаем здесь: у всех должно
  // быть одно число, а не пересчитанное по часовому поясу браузера.
  const today = todayLocal();

  const candidateViews = candidates.map((candidate) => ({
    id: candidate.id,
    fullName: candidate.fullName,
    currentPosition: candidate.currentPosition,
    city: candidate.city,
    stageId: candidate.stageId,
    daysOnStage: daysBetween(placeInDay(candidate.stageChangedAt).date, today),
  }));

  const stageViews = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    tone: stageTone(stage.key),
  }));

  return (
    // Шире прежнего: кандидаты теперь во всю ширину, а не в узкой колонке.
    <div className="mx-auto max-w-5xl">
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

      {/* Рекрутер и менеджер — одной строкой. Раньше под них уходили
          две крупные карточки, хотя это две фамилии. */}
      <p className="mt-3 text-sm text-ink-soft">
        Рекрутер: {job.recruiter?.fullName ?? "не назначен"}
        {" · менеджер: "}
        {job.hiringManager?.fullName ?? "не назначен"}
      </p>

      {/* Кандидаты — главное на странице вакансии, поэтому во всю ширину
          и выше описания. В боковой колонке на 320 пикселей их было
          не разобрать. */}
      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink-strong">Кандидаты</h2>

          {scope.can("candidates.create") && (
            <Link
              href={`/candidates/new?job=${job.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink transition hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Добавить кандидата
            </Link>
          )}
        </div>

        <JobCandidates stages={stageViews} candidates={candidateViews} />
      </div>

      {(job.description || job.requirements) && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {job.description && (
            <section className="rounded-xl border border-muted bg-surface p-5">
              <h2 className="text-sm font-medium text-ink">Описание</h2>
              <p className="mt-2 text-sm whitespace-pre-wrap text-ink-soft">
                {job.description}
              </p>
            </section>
          )}

          {job.requirements && (
            <section className="rounded-xl border border-muted bg-surface p-5">
              <h2 className="text-sm font-medium text-ink">Требования</h2>
              <p className="mt-2 text-sm whitespace-pre-wrap text-ink-soft">
                {job.requirements}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
