import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import {
  candidateVisibilityFilter,
  jobVisibilityFilter,
} from "@/lib/permissions";
import { JobStatusBadge } from "@/components/job-status-badge";
import { CANDIDATE_FORMS, plural } from "@/lib/format";
import type { StageKey } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Dashboard — LAMP" };

export default async function DashboardPage() {
  const scope = await getScope();
  const companyId = scope.companyId;

  // Важно: те же фильтры видимости, что и в разделах.
  // Нанимающий менеджер видит цифры только по своим вакансиям.
  const jobFilter = jobVisibilityFilter(scope.session.user);
  const candidateFilter = candidateVisibilityFilter(scope.session.user);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Все запросы идут одновременно. Так страница ждёт самый долгий из них,
  // а не их сумму: база во Франкфурте, каждое обращение стоит ~80 мс.
  const [
    stages,
    byStage,
    newCandidates,
    byInterviewStatus,
    activeJobs,
  ] = await Promise.all([
    db.stage.findMany({
      where: { companyId },
      select: { id: true, key: true },
    }),
    // Один запрос вместо пяти: сколько кандидатов на каждом этапе.
    db.candidate.groupBy({
      by: ["stageId"],
      where: { companyId, ...candidateFilter },
      _count: { _all: true },
    }),
    db.candidate.count({
      where: { companyId, createdAt: { gte: weekAgo }, ...candidateFilter },
    }),
    // Один запрос вместо двух: интервью по статусам.
    db.interview.groupBy({
      by: ["status"],
      where: { companyId, candidate: candidateFilter },
      _count: { _all: true },
    }),
    db.job.findMany({
      where: { companyId, status: "OPEN", ...jobFilter },
      include: { _count: { select: { candidates: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const countByStageId = new Map(
    byStage.map((row) => [row.stageId, row._count._all]),
  );

  const countByStage = (key: StageKey) => {
    const stage = stages.find((item) => item.key === key);
    return stage ? (countByStageId.get(stage.id) ?? 0) : 0;
  };

  const countByStatus = (status: string) =>
    byInterviewStatus.find((row) => row.status === status)?._count._all ?? 0;

  const candidates = byStage.reduce((sum, row) => sum + row._count._all, 0);
  const openJobs = activeJobs.length;
  const scheduledInterviews = countByStatus("SCHEDULED");
  const completedInterviews = countByStatus("COMPLETED");
  const offers = countByStage("OFFER");
  const hired = countByStage("HIRED");
  const rejected = countByStage("REJECTED");
  const noResponse = countByStage("NO_RESPONSE");

  const metrics = [
    { label: "Активные вакансии", value: openJobs },
    { label: "Всего кандидатов", value: candidates },
    { label: "Новые за неделю", value: newCandidates },
    { label: "Назначенные интервью", value: scheduledInterviews },
    { label: "Проведённые интервью", value: completedInterviews },
    { label: "Офферы", value: offers },
    { label: "Наняты", value: hired },
    { label: "Отказы", value: rejected },
    { label: "Не отвечают", value: noResponse },
  ];

  const isEmpty = candidates === 0 && openJobs === 0;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold text-ink-strong">
        {/* Пользователи вводят «Имя Фамилия», поэтому имя — первое слово. */}
        Здравствуйте, {scope.session.user.fullName.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Рабочее пространство компании «{scope.session.company.name}»
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {metrics.map((metric) => (
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

      {isEmpty ? (
        <div className="mt-6 rounded-xl border border-muted bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">С чего начать</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Создайте первую вакансию, а затем добавьте кандидатов — вручную или
            загрузив резюме. Показатели начнут заполняться сами.
          </p>
          {scope.can("jobs.manage") && (
            <Link
              href="/jobs/new"
              className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink transition hover:bg-accent-hover"
            >
              Создать вакансию
            </Link>
          )}
        </div>
      ) : (
        <section className="mt-6 overflow-hidden rounded-xl border border-muted bg-surface">
          <div className="flex items-center justify-between border-b border-muted px-4 py-2.5">
            <h2 className="text-sm font-medium text-ink">Активные вакансии</h2>
            <Link
              href="/jobs"
              className="text-xs text-ink-soft underline transition hover:text-ink"
            >
              Все вакансии
            </Link>
          </div>

          {activeJobs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-soft">
              Открытых вакансий нет.
            </p>
          ) : (
            <ul className="divide-y divide-muted">
              {activeJobs.slice(0, 8).map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-canvas"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm text-ink">{job.title}</p>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <span className="shrink-0 text-sm text-ink-soft">
                      {job._count.candidates}{" "}
                      {plural(job._count.candidates, CANDIDATE_FORMS)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
