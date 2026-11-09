import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { Avatar } from "@/components/avatar";
import { formatDate } from "@/lib/format";
import { INTERVIEW_STATUS_LABELS, INTERVIEW_TYPE_LABELS } from "@/lib/labels";
import { APP_TIMEZONE, todayLocal } from "@/lib/time";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  DEFAULT_DURATION,
  hourLabels,
  mondayOf,
  placeInDay,
  shiftDate,
  weekDays,
  weekRange,
  weekTitle,
} from "@/lib/calendar";
import { WeekCalendar, type CalendarEvent } from "./week-calendar";
import type { CalendarMeeting } from "./meeting-parts";
import { joinUrl } from "@/lib/meeting";

export const metadata: Metadata = { title: "Интервью — LAMP" };

const LIST_FILTERS = [
  { value: "list", label: "Предстоящие" },
  { value: "past", label: "Прошедшие" },
  { value: "all", label: "Все" },
];

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-glow text-ink",
  COMPLETED: "bg-khaki-soft text-khaki-ink",
  CANCELED: "bg-muted text-ink-soft",
};

function timeText(value: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(value);
}

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string }>;
}) {
  const scope = await getScope();
  const { view, week } = await searchParams;

  // По умолчанию открывается календарь: расписание читается быстрее
  // списка, а список остаётся рядом для поиска по прошедшим.
  const isCalendar = !view || view === "week";

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-strong">Интервью</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/interviews"
          className={`rounded-lg px-3 py-1.5 text-sm transition ${
            isCalendar
              ? "bg-ink-strong text-canvas"
              : "bg-muted text-ink-soft hover:text-ink"
          }`}
        >
          Календарь
        </Link>
        {LIST_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/interviews?view=${filter.value}`}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              view === filter.value
                ? "bg-ink-strong text-canvas"
                : "bg-muted text-ink-soft hover:text-ink"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {isCalendar ? (
        <CalendarView week={week} scope={scope} />
      ) : (
        <ListView view={view} scope={scope} />
      )}
    </div>
  );
}

type Scope = Awaited<ReturnType<typeof getScope>>;

async function CalendarView({ week, scope }: { week?: string; scope: Scope }) {
  const today = todayLocal();
  const monday = mondayOf(
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today,
  );
  const { from, to } = weekRange(monday);

  const canManage = scope.can("interviews.manage");

  const [interviews, candidates, users, company] = await Promise.all([
    db.interview.findMany({
      where: {
        companyId: scope.companyId,
        // Нанимающий менеджер видит интервью только своих кандидатов.
        candidate: candidateVisibilityFilter(scope.session.user),
        scheduledAt: { gte: from, lt: to },
      },
      include: {
        candidate: {
          select: { id: true, fullName: true, currentPosition: true },
        },
        interviewer: { select: { id: true, fullName: true } },
        // Решение по итогам встречи: по нему красится блок в сетке.
        feedbacks: {
          where: { result: { in: ["POSITIVE", "NEGATIVE"] } },
          orderBy: { createdAt: "desc" },
          select: { result: true },
          take: 1,
        },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    canManage
      ? db.candidate.findMany({
          where: {
            companyId: scope.companyId,
            ...candidateVisibilityFilter(scope.session.user),
          },
          select: { id: true, fullName: true, job: { select: { title: true } } },
          orderBy: { createdAt: "desc" },
          take: 300,
        })
      : Promise.resolve([]),
    canManage
      ? db.user.findMany({
          where: { companyId: scope.companyId, isActive: true },
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([]),
    // Постоянная ссылка компании на видеовстречу — для кнопки в форме.
    db.company.findUnique({
      where: { id: scope.companyId },
      select: { meetingLink: true },
    }),
  ]);

  const me = scope.session.user.id;

  // Собрания и напоминания недели — только те, куда позвали меня
  // (организатор тоже в списке участников). И коллеги для приглашения.
  const [meetingRows, colleagues] = await Promise.all([
    db.meeting.findMany({
      where: {
        companyId: scope.companyId,
        scheduledAt: { gte: from, lt: to },
        attendees: { some: { userId: me } },
      },
      include: {
        createdBy: { select: { fullName: true } },
        attendees: {
          include: { user: { select: { id: true, fullName: true } } },
          orderBy: { user: { fullName: "asc" } },
        },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    db.user.findMany({
      where: { companyId: scope.companyId, isActive: true, id: { not: me } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const meetings: CalendarMeeting[] = meetingRows.map((meeting) => {
    const { date, minutes } = placeInDay(meeting.scheduledAt);
    return {
      id: meeting.id,
      kind: meeting.kind,
      title: meeting.title,
      date,
      startMinutes: minutes,
      durationMinutes: meeting.durationMinutes,
      timeText: timeText(meeting.scheduledAt),
      meetingUrl: meeting.meetingUrl,
      comment: meeting.comment,
      organizerName: meeting.createdBy.fullName,
      isOrganizer: meeting.createdById === me,
      myStatus: meeting.attendees.find((item) => item.userId === me)?.status ?? "PENDING",
      attendees: meeting.attendees.map((item) => ({
        id: item.user.id,
        name: item.user.fullName,
        status: item.status,
      })),
    };
  });

  // Раскладываем по сетке на сервере: день и минуты от полуночи
  // считаются в часовом поясе компании, а не в браузере.
  const events: CalendarEvent[] = interviews.map((interview) => {
    const { date, minutes } = placeInDay(interview.scheduledAt);

    return {
      id: interview.id,
      candidateId: interview.candidate.id,
      candidateName: interview.candidate.fullName,
      candidatePosition: interview.candidate.currentPosition,
      type: interview.type,
      typeLabel: INTERVIEW_TYPE_LABELS[interview.type],
      status: interview.status,
      statusLabel: INTERVIEW_STATUS_LABELS[interview.status],
      date,
      startMinutes: minutes,
      durationMinutes: interview.durationMinutes || DEFAULT_DURATION,
      timeText: timeText(interview.scheduledAt),
      decision:
        interview.feedbacks[0]?.result === "POSITIVE"
          ? ("NEXT" as const)
          : interview.feedbacks[0]?.result === "NEGATIVE"
            ? ("REJECT" as const)
            : null,
      interviewerId: interview.interviewer?.id ?? null,
      interviewerName: interview.interviewer?.fullName ?? null,
      comment: interview.comment,
      joinUrl: joinUrl(interview),
      meetingUrl: interview.meetingUrl ?? "",
    };
  });

  const nowParts = placeInDay(new Date());
  const days = weekDays(monday, today);

  // Красную черту «сейчас» показываем, только если текущий момент
  // попадает и в показанную неделю, и в видимые часы суток.
  const showNow =
    days.some((day) => day.date === nowParts.date) &&
    nowParts.minutes >= DAY_START_HOUR * 60 &&
    nowParts.minutes <= DAY_END_HOUR * 60;

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">{weekTitle(monday)}</p>

        <div className="flex items-center gap-1">
          <Link
            href={`/interviews?week=${shiftDate(monday, -7)}`}
            aria-label="Предыдущая неделя"
            className="rounded-lg border border-line-strong p-1.5 text-ink transition hover:bg-canvas"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
          </Link>
          <Link
            href="/interviews"
            className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink transition hover:bg-canvas"
          >
            Сегодня
          </Link>
          <Link
            href={`/interviews?week=${shiftDate(monday, 7)}`}
            aria-label="Следующая неделя"
            className="rounded-lg border border-line-strong p-1.5 text-ink transition hover:bg-canvas"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>
      </div>

      <WeekCalendar
        days={days}
        hours={hourLabels()}
        events={events}
        meetings={meetings}
        colleagues={colleagues}
        candidates={candidates.map((candidate) => ({
          id: candidate.id,
          fullName: candidate.fullName,
          jobTitle: candidate.job?.title ?? null,
        }))}
        users={users}
        canManage={canManage}
        canDecide={scope.can("feedback.create")}
        canMoveStage={scope.can("candidates.move")}
        meetingLink={company?.meetingLink ?? null}
        nowMarker={showNow ? nowParts : null}
        dayStartHour={DAY_START_HOUR}
        dayEndHour={DAY_END_HOUR}
      />

      <p className="mt-3 text-xs text-ink-soft">
        {canManage
          ? "Нажмите на свободное место в сетке, чтобы назначить интервью, собрание или напоминание на это время. Серым — приглашения, на которые вы ещё не ответили."
          : "Здесь видны интервью ваших кандидатов. Нажмите на свободное время, чтобы назначить собрание с коллегами или напоминание себе."}
      </p>
    </div>
  );
}

async function ListView({ view, scope }: { view?: string; scope: Scope }) {
  const now = new Date();

  const period =
    view === "past"
      ? { scheduledAt: { lt: now } }
      : view === "all"
        ? {}
        : { scheduledAt: { gte: now }, status: "SCHEDULED" as const };

  const interviews = await db.interview.findMany({
    where: {
      companyId: scope.companyId,
      candidate: candidateVisibilityFilter(scope.session.user),
      ...period,
    },
    include: {
      candidate: { select: { id: true, fullName: true, photoKey: true } },
      job: { select: { title: true } },
      interviewer: { select: { fullName: true } },
    },
    orderBy: { scheduledAt: view === "list" ? "asc" : "desc" },
    take: 200,
  });

  // Группируем по дню, чтобы список читался как расписание.
  const days = new Map<string, typeof interviews>();
  for (const interview of interviews) {
    const key = formatDate(interview.scheduledAt);
    const list = days.get(key) ?? [];
    list.push(interview);
    days.set(key, list);
  }

  if (interviews.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
        <p className="text-sm text-ink-soft">
          Записей нет. Интервью назначаются в календаре или в карточке
          кандидата.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <p className="text-sm text-ink-soft">Всего: {interviews.length}</p>

      {[...days.entries()].map(([day, items]) => (
        <section
          key={day}
          className="overflow-hidden rounded-xl border border-line bg-surface"
        >
          <div className="border-b border-line px-4 py-2.5">
            <p className="text-sm font-medium text-ink">{day}</p>
          </div>

          <ul className="divide-y divide-line">
            {items.map((interview) => (
              <li key={interview.id}>
                <Link
                  href={`/candidates/${interview.candidate.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-canvas"
                >
                  <span className="w-12 shrink-0 text-sm font-medium text-ink">
                    {timeText(interview.scheduledAt)}
                  </span>

                  <Avatar
                    name={interview.candidate.fullName}
                    size="sm"
                    candidateId={interview.candidate.id}
                    hasPhoto={Boolean(interview.candidate.photoKey)}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm text-ink">
                        {interview.candidate.fullName}
                      </p>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs ${STATUS_STYLES[interview.status]}`}
                      >
                        {INTERVIEW_STATUS_LABELS[interview.status]}
                      </span>
                    </div>
                    <p className="truncate text-xs text-ink-soft">
                      {INTERVIEW_TYPE_LABELS[interview.type]}
                      {interview.job ? ` · ${interview.job.title}` : ""}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      Интервьюер:{" "}
                      {interview.interviewer?.fullName ?? "не назначен"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
