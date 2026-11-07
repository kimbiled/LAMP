import { daysAgo } from "@/lib/time";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireScope } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { CANDIDATE_FORMS, plural } from "@/lib/format";
import { rejectionLabel } from "@/lib/rejection";
import type { SourceChannel, StageKey } from "@/generated/prisma/enums";
import { isProgressStep } from "@/lib/stages";
import { LEGACY_ALIASES, daysToOffer, median, percent } from "@/lib/analytics";
import { SOURCE_CHANNEL_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Аналитика — LAMP" };

// Каналы в том порядке, в каком их выбирают в форме. «Не указан» —
// кандидаты, заведённые до появления поля или без выбора.
const DAY_FORMS: [string, string, string] = ["день", "дня", "дней"];

const CHANNEL_ORDER: (SourceChannel | null)[] = ["COLD", "WARM", "REFERRAL", null];

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
    stages,
    people,
    interviewsByInterviewer,
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
      select: {
        id: true,
        stageId: true,
        sourceChannel: true,
        createdAt: true,
        createdById: true,
        stage: { select: { key: true } },
      },
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
        toStageId: true,
        createdAt: true,
        toStage: { select: { key: true } },
      },
      orderBy: { createdAt: "asc" },
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
    // Этапы компании по порядку: воронка строится по ним, поэтому
    // этапы из конструктора в ней тоже видны.
    db.stage.findMany({
      where: { companyId: scope.companyId },
      orderBy: { position: "asc" },
      select: { id: true, name: true, key: true },
    }),
    db.user.findMany({
      where: { companyId: scope.companyId },
      select: { id: true, fullName: true },
    }),
    db.interview.groupBy({
      by: ["interviewerId"],
      where: {
        companyId: scope.companyId,
        status: "COMPLETED",
        interviewerId: { not: null },
        candidate: candidateWhere,
      },
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

  // То же по самим этапам: у своих этапов компании ключа нет.
  const reachedStage = new Map<string, Set<string>>();
  const rememberStage = (stageId: string | null, candidateId: string) => {
    if (!stageId) return;
    const set = reachedStage.get(stageId) ?? new Set<string>();
    set.add(candidateId);
    reachedStage.set(stageId, set);
  };

  // Когда кандидат впервые дошёл до оффера — для срока закрытия.
  const offerReachedAt = new Map<string, Date>();

  for (const item of history) {
    remember(item.toStage?.key, item.candidateId);
    rememberStage(item.toStageId, item.candidateId);
    const key = item.toStage?.key;
    if ((key === "OFFER" || key === "HIRED") && !offerReachedAt.has(item.candidateId)) {
      offerReachedAt.set(item.candidateId, item.createdAt);
    }
  }

  // Текущий этап тоже считается достигнутым — на случай,
  // если запись в истории по какой-то причине отсутствует.
  for (const candidate of candidates) {
    remember(candidate.stage.key, candidate.id);
    rememberStage(candidate.stageId, candidate.id);
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

  // Воронка: все кандидаты, затем рабочие этапы компании по порядку.
  // Первый этап пропускаем — туда попадают все новые, он равен «Кандидатам».
  const progressStages = stages.filter((stage) => isProgressStep(stage.key));
  const funnel = [
    { label: "Кандидаты", value: candidates.length },
    ...progressStages.slice(1).map((stage) => {
      const ids = new Set(reachedStage.get(stage.id) ?? []);
      if (stage.key) {
        for (const alias of LEGACY_ALIASES[stage.key] ?? []) {
          for (const id of reached.get(alias) ?? []) ids.add(id);
        }
      }
      return { label: stage.name, value: ids.size };
    }),
  ];

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
  const conversion = percent(offers, total);
  const offerIds = new Set([
    ...(reached.get("OFFER") ?? []),
    ...(reached.get("HIRED") ?? []),
  ]);

  // Типичный срок от добавления до оффера.
  const medianDaysToOffer = median(daysToOffer(candidates, offerReachedAt));

  // Каналы привлечения: сколько пришло и сколько дошло до оффера.
  const channels = CHANNEL_ORDER.map((channel) => {
    const group = candidates.filter((item) => item.sourceChannel === channel);
    const reachedOffer = group.filter((item) => offerIds.has(item.id)).length;
    return {
      label: channel ? SOURCE_CHANNEL_LABELS[channel] : "Не указан",
      total: group.length,
      offers: reachedOffer,
      conversion: percent(reachedOffer, group.length),
    };
  }).filter((row) => row.total > 0);

  // Команда: кто сколько добавил кандидатов, провёл интервью
  // и сколько из добавленных им людей дошло до оффера.
  const names = new Map(people.map((person) => [person.id, person.fullName]));
  const interviewsDone = new Map(
    interviewsByInterviewer.map((row) => [row.interviewerId, row._count._all]),
  );
  const team = people
    .map((person) => {
      const added = candidates.filter((item) => item.createdById === person.id);
      return {
        name: names.get(person.id) ?? "—",
        added: added.length,
        offers: added.filter((item) => offerIds.has(item.id)).length,
        interviews: interviewsDone.get(person.id) ?? 0,
      };
    })
    .filter((row) => row.added > 0 || row.interviews > 0)
    .sort((a, b) => b.added + b.interviews - (a.added + a.interviews));

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
          ? `${total} ${plural(total, CANDIDATE_FORMS)} в выборке · до оффера доходит ${conversion}%` +
            (medianDaysToOffer !== null
              ? ` · обычно за ${medianDaysToOffer} ${plural(medianDaysToOffer, DAY_FORMS)}`
              : "")
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
          неё хотя бы раз — даже если сейчас уже получил отказ. Ступени — рабочие
          этапы компании в порядке из настроек.
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


      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink-strong">
            Каналы привлечения
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            Откуда пришли кандидаты и сколько из них дошло до оффера.
            Канал выбирают в карточке кандидата.
          </p>

          {channels.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">Данных пока нет.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-soft">
                  <th className="pb-2 font-normal">Канал</th>
                  <th className="pb-2 text-right font-normal">Кандидаты</th>
                  <th className="pb-2 text-right font-normal">Офферы</th>
                  <th className="pb-2 text-right font-normal">Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="py-2 text-ink">{row.label}</td>
                    <td className="py-2 text-right text-ink">{row.total}</td>
                    <td className="py-2 text-right text-ink">{row.offers}</td>
                    <td className="py-2 text-right text-ink-soft">{row.conversion}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink-strong">Команда</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Кто сколько добавил кандидатов в выборке, сколько из них дошло
            до оффера и сколько интервью человек провёл.
          </p>

          {team.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">Данных пока нет.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-soft">
                  <th className="pb-2 font-normal">Сотрудник</th>
                  <th className="pb-2 text-right font-normal">Добавил</th>
                  <th className="pb-2 text-right font-normal">Офферы</th>
                  <th className="pb-2 text-right font-normal">Интервью</th>
                </tr>
              </thead>
              <tbody>
                {team.map((row) => (
                  <tr key={row.name} className="border-t border-line">
                    <td className="py-2 text-ink">{row.name}</td>
                    <td className="py-2 text-right text-ink">{row.added}</td>
                    <td className="py-2 text-right text-ink">{row.offers}</td>
                    <td className="py-2 text-right text-ink">{row.interviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

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
