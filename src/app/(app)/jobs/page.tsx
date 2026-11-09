import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { jobVisibilityFilter } from "@/lib/permissions";
import { JobStatusBadge } from "@/components/job-status-badge";
import { JobPriorityBadge } from "@/components/job-priority-badge";
import {
  CANDIDATE_FORMS,
  formatDate,
  formatSalary,
  plural,
} from "@/lib/format";
import type { JobStatus, StageKey } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Вакансии — Skillo" };

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Все" },
  { value: "OPEN", label: "Открытые" },
  { value: "PAUSED", label: "Приостановленные" },
  { value: "CLOSED", label: "Закрытые" },
];

// Ступени, по которым показываем движение людей на вакансии.
// «Интервью» объединяет техническое и финальное: на карточке вакансии
// важно, что человек дошёл до встреч, а какая именно — видно внутри.
const PROGRESS: { label: string; keys: StageKey[] }[] = [
  { label: "скрининг", keys: ["SCREENING"] },
  { label: "интервью", keys: ["TECH_INTERVIEW", "FINAL_INTERVIEW"] },
  { label: "оффер", keys: ["OFFER", "HIRED"] },
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

  // Вакансии, счётчики по статусам для фильтров и раскладка кандидатов
  // по этапам — тремя запросами одновременно.
  const visible = {
    companyId: scope.companyId,
    // Нанимающий менеджер видит только назначенные ему вакансии.
    ...jobVisibilityFilter(scope.session.user),
  };

  const [jobs, statusCounts, stages, byStage] = await Promise.all([
    db.job.findMany({
      where: { ...visible, ...(activeFilter ? { status: activeFilter } : {}) },
      include: {
        recruiter: { select: { fullName: true } },
        hiringManager: { select: { fullName: true } },
        _count: { select: { candidates: true } },
      },
      // Сначала открытые, внутри них — сначала срочные, а при равном
      // приоритете сверху свежие. Порядок статусов и приоритетов задан
      // порядком значений в схеме базы, а не этим файлом.
      orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
    }),
    db.job.groupBy({
      by: ["status"],
      where: visible,
      _count: { _all: true },
    }),
    db.stage.findMany({
      where: { companyId: scope.companyId },
      select: { id: true, key: true },
    }),
    db.candidate.groupBy({
      by: ["jobId", "stageId"],
      where: { companyId: scope.companyId, job: visible },
      _count: { _all: true },
    }),
  ]);

  const canManage = scope.can("jobs.manage");

  // Сколько вакансий в каждом статусе — для цифр рядом с фильтрами.
  const countByStatus = new Map(
    statusCounts.map((row) => [row.status as string, row._count._all]),
  );
  const totalJobs = statusCounts.reduce((sum, row) => sum + row._count._all, 0);

  const filterCount = (value: string) =>
    value === "" ? totalJobs : (countByStatus.get(value) ?? 0);

  // Этап кандидата известен по stageId, а ступень воронки — по ключу этапа.
  const keyByStage = new Map(stages.map((stage) => [stage.id, stage.key]));

  const progressByJob = new Map<string, Map<string, number>>();
  for (const row of byStage) {
    if (!row.jobId) continue;

    const key = keyByStage.get(row.stageId);
    const step = PROGRESS.find((item) => key && item.keys.includes(key));
    if (!step) continue;

    const counters = progressByJob.get(row.jobId) ?? new Map<string, number>();
    counters.set(step.label, (counters.get(step.label) ?? 0) + row._count._all);
    progressByJob.set(row.jobId, counters);
  }

  return (
    // Шире остальных страниц: плитке нужно место на три колонки,
    // иначе карточки становятся узкими и названия переносятся.
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-strong">Вакансии</h1>

        {canManage && (
          <Link
            href="/jobs/new"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-hover sm:w-auto"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Создать вакансию
          </Link>
        )}
      </div>

      {/* Фильтры с количеством: сразу видно, есть ли что смотреть
          в приостановленных, не открывая их. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const isActive = (status ?? "") === filter.value;
          const count = filterCount(filter.value);

          return (
            <Link
              key={filter.label}
              href={filter.value ? `/jobs?status=${filter.value}` : "/jobs"}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                isActive
                  ? "bg-ink-strong font-medium text-canvas"
                  : "text-ink-soft hover:bg-muted hover:text-ink"
              }`}
            >
              {filter.label}
              <span
                className={isActive ? "text-canvas/70" : "text-ink-soft"}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {jobs.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="text-sm text-ink-soft">
            {canManage
              ? "Создайте первую вакансию — после этого можно будет добавлять кандидатов."
              : "Вам пока не назначено ни одной вакансии."}
          </p>
        </div>
      ) : (
        // Плиткой, а не списком: строка во всю ширину оставляла справа
        // пустоту, а десяток вакансий превращался в длинную простыню.
        // Карточки в ряду одной высоты, число кандидатов прижато к низу.
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => {
            const counters = progressByJob.get(job.id);

            // Ступени без людей не показываем: «0 скрининг» ничего
            // не говорит и только удлиняет строку.
            const steps = PROGRESS.filter(
              (step) => (counters?.get(step.label) ?? 0) > 0,
            ).map((step) => ({
              label: step.label,
              value: counters?.get(step.label) ?? 0,
            }));

            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex h-full flex-col rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:border-ink-soft hover:bg-canvas"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <p className="min-w-0 flex-1 text-base leading-snug font-semibold text-ink-strong">
                    {job.title}
                  </p>
                  <JobPriorityBadge priority={job.priority} />
                  <JobStatusBadge status={job.status} />
                </div>

                <p className="mt-2 text-sm text-ink-soft">
                  {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
                </p>
                <p className="text-sm text-ink-soft">
                  Создана {formatDate(job.createdAt)}
                </p>
                <p className="mt-1 truncate text-sm text-ink-soft">
                  Рекрутер: {job.recruiter?.fullName ?? "не назначен"}
                </p>
                <p className="truncate text-sm text-ink-soft">
                  Менеджер: {job.hiringManager?.fullName ?? "не назначен"}
                </p>

                {/* mt-auto прижимает итог к низу карточки: у всех вакансий
                    в ряду он оказывается на одной линии. */}
                <div className="mt-auto pt-3">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t border-line pt-3 text-sm">
                    <span className="font-medium text-ink">
                      {job._count.candidates}{" "}
                      {plural(job._count.candidates, CANDIDATE_FORMS)}
                    </span>
                    {steps.map((step) => (
                      <span key={step.label} className="text-ink-soft">
                        <span className="mr-1.5">→</span>
                        {step.value} {step.label}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
