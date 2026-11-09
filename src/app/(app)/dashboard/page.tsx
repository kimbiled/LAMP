import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Hourglass, MessageSquareText } from "lucide-react";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import {
  candidateVisibilityFilter,
  jobVisibilityFilter,
} from "@/lib/permissions";
import { JobStatusBadge } from "@/components/job-status-badge";
import { JobPriorityBadge } from "@/components/job-priority-badge";
import { CANDIDATE_FORMS, DAY_FORMS, plural } from "@/lib/format";
import { INTERVIEW_TYPE_LABELS } from "@/lib/labels";
import { FUNNEL_KEYS } from "@/lib/stages";
import { minutesToTime, placeInDay, todayBounds } from "@/lib/calendar";
import { buttonClass } from "@/components/ui/styles";
import { staleLimit } from "@/lib/stale";
import { daysToOffer, median, percent } from "@/lib/analytics";
import { daysAgo } from "@/lib/time";
import { Mascot } from "@/components/mascot";
import { nextUnlock, readLook } from "@/lib/mascot";
import { closedThisMonth } from "@/lib/mascot-progress";

export const metadata: Metadata = { title: "Главная — LAMP" };

// Главная отвечает на вопрос «что мне сделать сегодня», а не показывает
// счётчики за всё время. Раньше здесь было девять цифр — от «Всего
// кандидатов» до «Отказали мы», — и ни одна не подсказывала, куда идти.
// Подробные цифры остались в «Аналитике».

// «Застрял» — дольше срока простоя из настроек: общего у компании
// или своего у рекрутера, который завёл кандидата.

export default async function DashboardPage() {
  const scope = await getScope();
  const companyId = scope.companyId;
  const me = scope.session.user.id;
  const canMove = scope.can("candidates.move");

  // Те же фильтры видимости, что и в разделах: менеджер видит
  // только своё.
  const jobFilter = jobVisibilityFilter(scope.session.user);
  const candidateFilter = candidateVisibilityFilter(scope.session.user);

  const { from, to, now, weekAgo } = todayBounds();
  // Самый короткий возможный срок — день: точный срок у каждого
  // кандидата свой, поэтому отбираем с запасом и досчитываем ниже.
  const stuckBefore = new Date(now.getTime() - 86_400_000);
  const [company, myLook, closedMonth] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { staleDays: true },
    }),
    db.user.findUnique({ where: { id: me }, select: { mascot: true } }),
    closedThisMonth(me, companyId),
  ]);
  const unlock = nextUnlock(closedMonth);

  // Рекрутер и администратор видят все встречи дня,
  // нанимающий менеджер — те, где он интервьюер.
  const todayWhere = canMove
    ? { companyId, candidate: candidateFilter }
    : { companyId, interviewerId: me };

  // Все запросы идут одновременно: база во Франкфурте, каждое
  // обращение стоит ~80 мс, и ждём мы самый долгий, а не их сумму.
  const [todayInterviews, awaitingFeedback, stuck, inWork, newThisWeek, scheduled, activeJobs] =
    await Promise.all([
      db.interview.findMany({
        where: {
          ...todayWhere,
          status: { not: "CANCELED" },
          scheduledAt: { gte: from, lt: to },
        },
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          interviewer: { select: { fullName: true } },
          candidate: { select: { id: true, fullName: true } },
        },
        orderBy: { scheduledAt: "asc" },
        take: 10,
      }),
      // Встреча прошла, я на ней был интервьюером, а мнения от меня нет.
      db.interview.findMany({
        where: {
          companyId,
          interviewerId: me,
          status: { not: "CANCELED" },
          scheduledAt: { lt: now },
          candidate: { feedbacks: { none: { authorId: me } } },
        },
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          candidate: { select: { id: true, fullName: true } },
        },
        orderBy: { scheduledAt: "desc" },
        take: 5,
      }),
      canMove
        ? db.candidate.findMany({
            where: {
              companyId,
              ...candidateFilter,
              stage: { key: { in: FUNNEL_KEYS.filter((key) => key !== "OFFER") } },
              stageChangedAt: { lt: stuckBefore },
            },
            select: {
              id: true,
              fullName: true,
              stageChangedAt: true,
              stage: { select: { name: true, key: true } },
              job: { select: { title: true } },
              createdBy: { select: { role: true, staleDays: true } },
            },
            orderBy: { stageChangedAt: "asc" },
            take: 200,
          })
        : Promise.resolve([]),
      db.candidate.count({
        where: {
          companyId,
          ...candidateFilter,
          stage: { key: { in: FUNNEL_KEYS } },
        },
      }),
      db.candidate.count({
        where: { companyId, createdAt: { gte: weekAgo }, ...candidateFilter },
      }),
      db.interview.count({
        where: {
          ...todayWhere,
          status: "SCHEDULED",
          scheduledAt: { gte: now },
        },
      }),
      db.job.findMany({
        where: { companyId, status: "OPEN", ...jobFilter },
        include: { _count: { select: { candidates: true } } },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      }),
    ]);

  const daysOn = (value: Date) =>
    Math.max(1, Math.floor((now.getTime() - value.getTime()) / 86_400_000));

  const stuckNow = stuck
    .filter(
      (candidate) =>
        daysOn(candidate.stageChangedAt) >= staleLimit(company?.staleDays, candidate.createdBy),
    )
    .slice(0, 5);

  const mini = scope.can("analytics.view")
    ? await loadMiniAnalytics(companyId, candidateFilter)
    : null;

  const metrics = [
    { label: "Открытые вакансии", value: activeJobs.length, href: "/jobs" },
    { label: "Кандидаты в работе", value: inWork, href: "/candidates" },
    { label: "Новые за неделю", value: newThisWeek, href: "/candidates?period=7" },
    { label: "Предстоящие интервью", value: scheduled, href: "/interviews" },
  ];

  const isEmpty = inWork === 0 && activeJobs.length === 0;
  const nothingToday =
    todayInterviews.length === 0 && awaitingFeedback.length === 0 && stuckNow.length === 0;

  const timeOf = (value: Date) => minutesToTime(placeInDay(value).minutes);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-strong">
            {/* Пользователи вводят «Имя Фамилия», поэтому имя — первое слово. */}
            Здравствуйте, {scope.session.user.fullName.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Рабочее пространство компании «{scope.session.company.name}»
          </p>
        </div>

        {/* Персонаж: наряжается за закрытые вакансии месяца. */}
        <Link
          href="/mascot"
          className="flex shrink-0 items-center gap-3 rounded-xl border border-line bg-surface py-2 pr-4 pl-2 transition hover:border-line-strong"
        >
          <Mascot look={readLook(myLook?.mascot)} size={56} title="Мой персонаж" />
          <span className="hidden text-sm sm:block">
            <span className="block font-medium text-ink">
              Закрыто в месяце: {closedMonth}
            </span>
            <span className="block text-xs text-ink-soft">
              {unlock ? `Ещё ${unlock.need} до «${unlock.label}»` : "Открыто всё!"}
            </span>
          </span>
        </Link>
      </div>

      {isEmpty ? (
        <section className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-ink-strong">С чего начать</h2>
          <ol className="mt-3 space-y-2 text-sm text-ink">
            <li>1. Создайте вакансию — на кого ищете людей.</li>
            <li>2. Добавьте кандидатов: загрузите резюме или импортируйте с hh.</li>
            <li>3. Пригласите коллег, которые будут собеседовать и оставлять отзывы.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-3">
            {scope.can("jobs.manage") && (
              <Link href="/jobs/new" className={buttonClass({ variant: "primary" })}>
                Создать вакансию
              </Link>
            )}
            {scope.can("users.manage") && (
              <Link href="/users/new" className={buttonClass({ variant: "secondary" })}>
                Пригласить коллегу
              </Link>
            )}
          </div>
        </section>
      ) : (
        <>
          <h2 className="mt-6 text-lg font-semibold text-ink-strong">Сегодня</h2>

          {nothingToday ? (
            <p className="mt-2 rounded-xl border border-dashed border-line bg-surface px-5 py-6 text-sm text-ink-soft">
              На сегодня срочных дел нет: встреч не назначено, все отзывы оставлены.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <TodayCard
                icon={CalendarClock}
                title="Интервью сегодня"
                empty="Встреч на сегодня нет"
                href="/interviews"
                items={todayInterviews.map((interview) => ({
                  id: interview.id,
                  href: `/candidates/${interview.candidate.id}`,
                  primary: interview.candidate.fullName,
                  secondary: `${timeOf(interview.scheduledAt)} · ${INTERVIEW_TYPE_LABELS[interview.type]}${
                    canMove && interview.interviewer ? ` · ${interview.interviewer.fullName}` : ""
                  }`,
                }))}
              />
              <TodayCard
                icon={MessageSquareText}
                title="Ждут вашего отзыва"
                empty="Все отзывы оставлены"
                tone="warning"
                items={awaitingFeedback.map((interview) => ({
                  id: interview.id,
                  href: `/candidates/${interview.candidate.id}`,
                  primary: interview.candidate.fullName,
                  secondary: `${INTERVIEW_TYPE_LABELS[interview.type]} · ${placeInDay(interview.scheduledAt).date.split("-").reverse().join(".")}`,
                }))}
              />
              {canMove && (
                <TodayCard
                  icon={Hourglass}
                  title="Застряли на этапе"
                  empty="Все кандидаты движутся"
                  href="/candidates"
                  items={stuckNow.map((candidate) => ({
                    id: candidate.id,
                    href: `/candidates/${candidate.id}`,
                    primary: candidate.fullName,
                    secondary: `${candidate.stage.name} · ${daysOn(candidate.stageChangedAt)} ${plural(daysOn(candidate.stageChangedAt), DAY_FORMS)}`,
                  }))}
                />
              )}
            </div>
          )}

          {mini && <MiniAnalytics data={mini} />}

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map((metric) => (
              <Link
                key={metric.label}
                href={metric.href}
                className="rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:border-line-strong"
              >
                <p className="text-2xl font-semibold text-ink-strong">{metric.value}</p>
                <p className="mt-1 text-sm text-ink-soft">{metric.label}</p>
              </Link>
            ))}
          </div>

          <section className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-base font-semibold text-ink-strong">Открытые вакансии</h2>
              <Link href="/jobs" className={buttonClass({ variant: "ghost", size: "sm" })}>
                Все вакансии
              </Link>
            </div>

            {activeJobs.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-soft">Открытых вакансий нет.</p>
            ) : (
              <ul className="divide-y divide-line">
                {activeJobs.slice(0, 8).map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-canvas"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-ink">{job.title}</p>
                        <JobPriorityBadge priority={job.priority} />
                        <JobStatusBadge status={job.status} />
                      </div>
                      <span className="shrink-0 text-sm text-ink-soft">
                        {job._count.candidates} {plural(job._count.candidates, CANDIDATE_FORMS)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function TodayCard({
  icon: Icon,
  title,
  empty,
  href,
  items,
  tone,
}: {
  icon: typeof CalendarClock;
  title: string;
  empty: string;
  href?: string;
  items: { id: string; href: string; primary: string; secondary: string }[];
  tone?: "warning";
}) {
  const highlighted = tone === "warning" && items.length > 0;
  return (
    <section
      className={`rounded-xl border p-4 shadow-sm ${
        highlighted ? "border-warning-line bg-warning-soft" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-strong">
          <Icon className="h-4 w-4 text-ink-soft" strokeWidth={1.8} aria-hidden />
          {title}
          {items.length > 0 && (
            <span className="rounded-full bg-ink px-2 text-xs font-medium text-surface">
              {items.length}
            </span>
          )}
        </h3>
        {href && (
          <Link href={href} className="text-sm text-ink-soft underline hover:text-ink">
            Все
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="block py-2.5 transition hover:opacity-80">
                <p className="truncate text-sm font-medium text-ink">{item.primary}</p>
                <p className="truncate text-sm text-ink-soft">{item.secondary}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- Мини-аналитика на главной ----------
//
// Четыре главные цифры за 30 дней и столбики «новые кандидаты по
// неделям». Каждая цифра — ссылка в «Аналитику» с тем же периодом,
// где можно провалиться в подробности.

type MiniData = {
  added: number;
  offers: number;
  conversion: number;
  medianDays: number | null;
  weeks: { label: string; value: number }[];
};

async function loadMiniAnalytics(
  companyId: string,
  candidateFilter: ReturnType<typeof candidateVisibilityFilter>,
): Promise<MiniData> {
  const since = daysAgo(56) ?? new Date(0);
  const month = daysAgo(30) ?? new Date(0);

  const [candidates, offerHistory] = await Promise.all([
    db.candidate.findMany({
      where: { companyId, ...candidateFilter, createdAt: { gte: since } },
      select: { id: true, createdAt: true },
    }),
    db.candidateHistory.findMany({
      where: {
        companyId,
        candidate: { ...candidateFilter, createdAt: { gte: month } },
        toStage: { key: { in: ["OFFER", "HIRED"] } },
      },
      select: { candidateId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const recent = candidates.filter((candidate) => candidate.createdAt >= month);
  const offerAt = new Map<string, Date>();
  for (const item of offerHistory) {
    if (!offerAt.has(item.candidateId)) offerAt.set(item.candidateId, item.createdAt);
  }

  // Восемь недель, самая свежая справа.
  const weekMs = 7 * 86_400_000;
  const nowMs = Date.now();
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const end = nowMs - (7 - index) * weekMs;
    const start = end - weekMs;
    const value = candidates.filter(
      (candidate) => candidate.createdAt.getTime() > start && candidate.createdAt.getTime() <= end,
    ).length;
    const date = new Date(start + 86_400_000);
    return {
      label: `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`,
      value,
    };
  });

  return {
    added: recent.length,
    offers: offerAt.size,
    conversion: percent(offerAt.size, recent.length),
    medianDays: median(daysToOffer(recent, offerAt)),
    weeks,
  };
}

function MiniAnalytics({ data }: { data: MiniData }) {
  const max = Math.max(1, ...data.weeks.map((week) => week.value));
  const kpis = [
    { label: "Новых кандидатов", value: String(data.added) },
    { label: "Дошли до оффера", value: String(data.offers) },
    { label: "Конверсия в оффер", value: `${data.conversion}%` },
    {
      label: "Дней до оффера",
      value: data.medianDays === null ? "—" : String(data.medianDays),
      hint: "медиана",
    },
  ];

  return (
    <section className="mt-6 rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink-strong">
          Аналитика <span className="font-normal text-ink-soft">· 30 дней</span>
        </h2>
        <Link
          href="/analytics?period=30"
          className={buttonClass({ variant: "ghost", size: "sm" })}
        >
          Подробнее
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        </Link>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[3fr_2fr]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
          {kpis.map((kpi) => (
            <Link
              key={kpi.label}
              href="/analytics?period=30"
              className="rounded-lg border border-line bg-canvas px-3 py-2.5 transition hover:border-line-strong"
            >
              <p className="text-2xl font-semibold text-ink-strong tabular-nums">{kpi.value}</p>
              <p className="text-xs text-ink-soft">
                {kpi.label}
                {kpi.hint ? ` · ${kpi.hint}` : ""}
              </p>
            </Link>
          ))}
        </div>

        <Link
          href="/analytics?period=90"
          className="flex flex-col rounded-lg border border-line bg-canvas px-3 pt-2.5 pb-2 transition hover:border-line-strong"
          aria-label="Новые кандидаты по неделям — открыть аналитику"
        >
          <p className="text-xs text-ink-soft">Новые кандидаты по неделям</p>
          <div className="mt-2 flex min-h-16 flex-1 items-end gap-1.5">
            {data.weeks.map((week, index) => (
              <div key={week.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] leading-none text-ink-soft tabular-nums">
                  {week.value > 0 ? week.value : ""}
                </span>
                <div
                  title={`Неделя с ${week.label}: ${week.value}`}
                  className={`w-full rounded-t-sm ${index === data.weeks.length - 1 ? "bg-accent" : "bg-khaki-line"}`}
                  style={{ height: `${Math.max(3, (week.value / max) * 72)}px` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-ink-soft tabular-nums">
            <span>{data.weeks[0]?.label}</span>
            <span>эта неделя</span>
          </div>
        </Link>
      </div>
    </section>
  );
}
