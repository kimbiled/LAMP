import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { Avatar } from "@/components/avatar";
import { formatDate } from "@/lib/format";
import { INTERVIEW_STATUS_LABELS, INTERVIEW_TYPE_LABELS } from "@/lib/labels";
import { APP_TIMEZONE } from "@/lib/time";

export const metadata: Metadata = { title: "Интервью — LAMP" };

const FILTERS = [
  { value: "", label: "Предстоящие" },
  { value: "past", label: "Прошедшие" },
  { value: "all", label: "Все" },
];

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-accent/25 text-ink",
  COMPLETED: "bg-green-100 text-green-800",
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
  searchParams: Promise<{ view?: string }>;
}) {
  const scope = await getScope();
  const { view } = await searchParams;
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
      // Нанимающий менеджер видит интервью только своих кандидатов.
      candidate: candidateVisibilityFilter(scope.session.user),
      ...period,
    },
    include: {
      candidate: { select: { id: true, fullName: true } },
      job: { select: { title: true } },
      interviewer: { select: { fullName: true } },
    },
    orderBy: { scheduledAt: view === "" || !view ? "asc" : "desc" },
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

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold text-ink-strong">Интервью</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {interviews.length > 0
          ? `Всего: ${interviews.length}`
          : "Записей нет"}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const isActive = (view ?? "") === filter.value;
          return (
            <Link
              key={filter.label}
              href={filter.value ? `/interviews?view=${filter.value}` : "/interviews"}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                isActive
                  ? "bg-ink-strong text-canvas"
                  : "bg-muted text-ink-soft hover:text-ink"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {interviews.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-muted bg-surface p-10 text-center">
          <p className="text-sm text-ink-soft">
            Интервью назначаются в карточке кандидата.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {[...days.entries()].map(([day, items]) => (
            <section
              key={day}
              className="overflow-hidden rounded-xl border border-muted bg-surface"
            >
              <div className="border-b border-muted px-4 py-2.5">
                <p className="text-sm font-medium text-ink">{day}</p>
              </div>

              <ul className="divide-y divide-muted">
                {items.map((interview) => (
                  <li key={interview.id}>
                    <Link
                      href={`/candidates/${interview.candidate.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-canvas"
                    >
                      <span className="w-12 shrink-0 text-sm font-medium text-ink">
                        {timeText(interview.scheduledAt)}
                      </span>

                      <Avatar name={interview.candidate.fullName} size="sm" />

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
      )}
    </div>
  );
}
