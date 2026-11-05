import { daysAgo } from "@/lib/time";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireScope } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { CANDIDATE_FORMS, plural } from "@/lib/format";
import { rejectionLabel } from "@/lib/rejection";
import type { StageKey } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Аналитика — LAMP" };

// Ступени воронки. Некоторые ступени объединяют несколько этапов:
// «Интервью» — это и назначенное, и проведённое.
const FUNNEL: { label: string; keys: StageKey[] }[] = [
  { label: "Кандидаты", keys: [] },
  { label: "Контакт", keys: ["CONTACT"] },
  { label: "Скрининг", keys: ["SCREENING", "INTERVIEW_SCHEDULED"] },
  { label: "Техническое", keys: ["TECH_INTERVIEW", "INTERVIEW_DONE"] },
  { label: "Финал", keys: ["FINAL_INTERVIEW"] },
  { label: "Оффер", keys: ["OFFER", "HIRED"] },
];

const PERIODS = [
  { value: "", label: "Весь период", days: 0 },
  { value: "7", label: "7 дней", days: 7 },
  { value: "30", label: "30 дней", days: 30 },
  { value: "90", label: "90 дней", days: 90 },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; job?: string; recruiter?: string }>;
}) {
  const scope = await requireScope("analytics.view");
  const { period, job, recruiter } = await searchParams;

  const days = PERIODS.find((item) => item.value === (period ?? ""))?.days ?? 0;
  const since = daysAgo(days);

  // Отбираем кандидатов, попадающих под фильтры. Дальше считаем только по ним.
  const candidateWhere = {
    companyId: scope.companyId,
    ...candidateVisibilityFilter(scope.session.user),
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(job ? { jobId: job } : {}),
    ...(recruiter ? { job: { recruiterId: recruiter } } : {}),
  };

  // Все запросы уходят одновременно: история и интервью отбираются
  // по тем же условиям, что и кандидаты, поэтому ждать их не нужно.
  const [
    jobs,
    recruiters,
    candidates,
    history,
    completedInterviews,
    technicalInterviews,
    rejections,
  ] = await Promise.all([
    db.job.findMany({
      where: { companyId: scope.companyId },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: {
        companyId: scope.companyId,
        role: { in: ["ADMIN", "RECRUITER"] },
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    db.candidate.findMany({
      where: candidateWhere,
      select: { id: true, stage: { select: { key: true } } },
    }),
    // Через историю видно, до какого этапа кандидат доходил,
    // даже если сейчас он уже в «Отказе».
    db.candidateHistory.findMany({
      where: {
        companyId: scope.companyId,
        toStageId: { not: null },
        candidate: candidateWhere,
      },
      select: {
        candidateId: true,
        toStage: { select: { key: true } },
      },
    }),
    db.interview.count({
      where: {
        companyId: scope.companyId,
        status: "COMPLETED",
        candidate: candidateWhere,
      },
    }),
    db.interview.count({
      where: {
        companyId: scope.companyId,
        type: "TECHNICAL",
        candidate: candidateWhere,
      },
    }),
    // Причины отказов считаем прямо в базе: она сама группирует
    // и возвращает готовые числа.
    db.candidate.groupBy({
      by: ["rejectionReason"],
      where: { ...candidateWhere, rejectionReason: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const reached = new Map<string, Set<string>>();
  const remember = (key: string | null | undefined, candidateId: string) => {
    if (!key) return;
    const set = reached.get(key) ?? new Set<string>();
    set.add(candidateId);
    reached.set(key, set);
  };

  for (const item of history) {
    remember(item.toStage?.key, item.candidateId);
  }

  // Текущий этап тоже считается достигнутым — на случай,
  // если запись в истории по какой-то причине отсутствует.
  for (const candidate of candidates) {
    remember(candidate.stage.key, candidate.id);
  }

  const countReached = (keys: StageKey[]) => {
    if (keys.length === 0) return candidates.length;
    const union = new Set<string>();
    for (const key of keys) {
      for (const id of reached.get(key) ?? []) {
        union.add(id);
      }
    }
    return union.size;
  };

  const funnel = FUNNEL.map((step) => ({
    label: step.label,
    value: countReached(step.keys),
  }));

  const total = funnel[0].value;

  const metrics = [
    { label: "Всего кандидатов", value: total },
    { label: "Проведено интервью", value: completedInterviews },
    { label: "Технических интервью", value: technicalInterviews },
    { label: "Офферы", value: countReached(["OFFER", "HIRED"]) },
    { label: "Отказали мы", value: countReached(["WE_DECLINED", "REJECTED"]) },
    {
      label: "Отказался кандидат",
      value: countReached(["CANDIDATE_DECLINED"]),
    },
    {
      label: "Думают",
      value: countReached(["CANDIDATE_THINKING", "WE_THINKING"]),
    },
    { label: "Не отвечают", value: countReached(["NO_RESPONSE"]) },
  ];

  const offers = countReached(["OFFER", "HIRED"]);
  const conversion = total > 0 ? Math.round((offers / total) * 100) : 0;

  const reasons = rejections
    .map((row) => ({
      label: rejectionLabel(row.rejectionReason) ?? "Другое",
      value: row._count._all,
    }))
    .sort((a, b) => b.value - a.value);

  const reasonsTotal = reasons.reduce((sum, item) => sum + item.value, 0);

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-strong">Аналитика</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {total > 0
          ? `${total} ${plural(total, CANDIDATE_FORMS)} в выборке · до оффера доходит ${conversion}%`
          : "Данных пока нет"}
      </p>

      <form className="mt-5 grid gap-3 sm:grid-cols-4">
        <select
          name="period"
          defaultValue={period ?? ""}
          aria-label="Период"
          className="rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-accent"
        >
          {PERIODS.map((item) => (
            <option key={item.label} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <select
          name="job"
          defaultValue={job ?? ""}
          aria-label="Вакансия"
          className="rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-accent"
        >
          <option value="">Все вакансии</option>
          {jobs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>

        <select
          name="recruiter"
          defaultValue={recruiter ?? ""}
          aria-label="Рекрутер"
          className="rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-accent"
        >
          <option value="">Все рекрутеры</option>
          {recruiters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.fullName}
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

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-line bg-surface p-4 shadow-sm"
          >
            <p className="text-2xl font-semibold text-ink-strong">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-ink-soft">{metric.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-5 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink-strong">
          Воронка подбора
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          Считается по истории: кандидат учитывается на ступени, если доходил до
          неё хотя бы раз — даже если сейчас уже получил отказ.
        </p>

        {total === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            Добавьте кандидатов, и воронка заполнится.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {funnel.map((step, index) => {
              const share = total > 0 ? (step.value / total) * 100 : 0;
              const previous = index > 0 ? funnel[index - 1].value : null;
              const stepConversion =
                previous && previous > 0
                  ? Math.round((step.value / previous) * 100)
                  : null;

              return (
                <li key={step.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm text-ink">{step.label}</p>
                    <p className="text-sm text-ink-soft">
                      <span className="font-medium text-ink">{step.value}</span>
                      {stepConversion !== null && (
                        <span> · {stepConversion}% с прошлой ступени</span>
                      )}
                    </p>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${Math.max(share, step.value > 0 ? 3 : 0)}%`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-5 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink-strong">
          Причины отказов
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          Заполняется при переводе на «Отказ от нас» и «Отказ от кандидата».
          Причину можно пропустить — такие отказы сюда не попадают.
        </p>

        {reasons.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            Пока ни одной причины не указано.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {reasons.map((reason) => {
              const share =
                reasonsTotal > 0 ? (reason.value / reasonsTotal) * 100 : 0;

              return (
                <li key={reason.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm text-ink">{reason.label}</p>
                    <p className="text-sm text-ink-soft">
                      <span className="font-medium text-ink">
                        {reason.value}
                      </span>
                      <span> · {Math.round(share)}%</span>
                    </p>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(share, 3)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <p className="mt-4 text-xs text-ink-soft">
        Фильтр по рекрутеру отбирает кандидатов по вакансиям, где этот человек
        назначен рекрутером.
      </p>
    </div>
  );
}
