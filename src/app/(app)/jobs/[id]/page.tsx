import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/styles";
import { Pencil, Plus } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { db } from "@/lib/db";
import { getScope, assertOwnCompany } from "@/lib/tenant";
import { jobVisibilityFilter } from "@/lib/permissions";
import { JobStatusBadge } from "@/components/job-status-badge";
import { JobPriorityBadge } from "@/components/job-priority-badge";
import { formatDate, formatSalary } from "@/lib/format";
import { stageGroup, stageTone } from "@/lib/stages";
import { rejectionSide } from "@/lib/rejection";
import { todayLocal, daysBetween } from "@/lib/time";
import { placeInDay } from "@/lib/calendar";
import { JobStatusSelect } from "./status-select";
import { JobPrioritySelect } from "./priority-select";
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
        photoKey: true,
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
    hasPhoto: Boolean(candidate.photoKey),
    daysOnStage: daysBetween(placeInDay(candidate.stageChangedAt).date, today),
  }));

  const stageViews = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    tone: stageTone(stage.key),
    group: stageGroup(stage.key),
    rejectionSide: rejectionSide(stage.key),
  }));

  return (
    // Шире прежнего: кандидаты теперь во всю ширину, а не в узкой колонке.
    <div>
      <BackButton fallbackHref="/jobs" fallbackLabel="К списку вакансий" />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink-strong">
              {job.title}
            </h1>
            {/* Тем, кто может менять статус и приоритет, они видны
                в списках справа — второй раз бейджем не повторяем. */}
            {!canManage && <JobPriorityBadge priority={job.priority} />}
            {!canManage && <JobStatusBadge status={job.status} />}
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
            {" · создана "}
            {formatDate(job.createdAt)} · {job.createdBy.fullName}
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <JobPrioritySelect jobId={job.id} priority={job.priority} />
            <JobStatusSelect jobId={job.id} status={job.status} />
            <Link
              href={`/jobs/${job.id}/edit`}
              className={buttonClass({ variant: "secondary" })}
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
        <JobCandidates
          stages={stageViews}
          candidates={candidateViews}
          canMove={scope.can("candidates.move")}
          action={
            scope.can("candidates.create") ? (
              <Link
                href={`/candidates/new?job=${job.id}`}
                className={buttonClass({ variant: "primary" })}
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Добавить кандидата
              </Link>
            ) : null
          }
        />
      </div>

      {(job.description || job.requirements) && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {job.description && (
            <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <h2 className="text-base font-semibold text-ink-strong">
                Описание
              </h2>
              <p className="mt-2 text-sm whitespace-pre-wrap text-ink-soft">
                {job.description}
              </p>
            </section>
          )}

          {job.requirements && (
            <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <h2 className="text-base font-semibold text-ink-strong">
                Требования
              </h2>
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
