import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { daysAgo, todayLocal } from "@/lib/time";
import { shiftDate } from "@/lib/calendar";
import { AddTaskForm, TaskItem, type TaskView } from "@/components/tasks";
import { buttonClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Блокнот — LAMP" };

// Блокнот: личный список дел с календарём.
//
// Слева — месяц: точки показывают дни, на которые что-то запланировано.
// Справа — дела выбранного дня, просроченные и «без даты». К делу
// можно привязать кандидата: тогда оно видно и в его карточке.
// Всё личное — коллеги чужие записи не видят.

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function asDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dayTitle(day: string, today: string): string {
  const [, month, date] = day.split("-").map(Number);
  const text = `${date} ${MONTHS_GENITIVE[month - 1]}`;
  if (day === today) return `Сегодня, ${text}`;
  if (day === shiftDate(today, 1)) return `Завтра, ${text}`;
  if (day === shiftDate(today, -1)) return `Вчера, ${text}`;
  return text;
}

export default async function NotebookPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const scope = await getScope();
  const me = scope.session.user.id;
  const today = todayLocal();
  const raw = (await searchParams).day;
  const day = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;

  const [year, month] = day.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const own = { companyId: scope.companyId, userId: me };
  const include = { candidate: { select: { id: true, fullName: true } } };
  // Выполненные дела без даты держим на виду ещё три дня.
  const recentlyDone = daysAgo(3) ?? new Date();

  const [monthTasks, dayTasks, overdue, undated, candidates] = await Promise.all([
    db.task.findMany({
      where: { ...own, dueAt: { gte: monthStart, lt: monthEnd } },
      select: { dueAt: true, done: true },
    }),
    db.task.findMany({
      where: { ...own, dueAt: new Date(`${day}T00:00:00Z`) },
      include,
      orderBy: [{ done: "asc" }, { createdAt: "asc" }],
    }),
    // Просроченное показываем только на сегодняшнем дне: смотреть
    // вчерашние долги, листая следующую неделю, незачем.
    day === today
      ? db.task.findMany({
          where: { ...own, done: false, dueAt: { lt: new Date(`${today}T00:00:00Z`) } },
          include,
          orderBy: { dueAt: "asc" },
        })
      : Promise.resolve([]),
    db.task.findMany({
      where: {
        ...own,
        dueAt: null,
        OR: [{ done: false }, { doneAt: { gte: recentlyDone } }],
      },
      include,
      orderBy: [{ done: "asc" }, { createdAt: "desc" }],
    }),
    db.candidate.findMany({
      where: { companyId: scope.companyId, ...candidateVisibilityFilter(scope.session.user) },
      select: { id: true, fullName: true, currentPosition: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ]);

  const view = (task: (typeof dayTasks)[number]): TaskView => ({
    id: task.id,
    title: task.title,
    note: task.note,
    day: task.dueAt ? asDay(task.dueAt) : null,
    done: task.done,
    candidate: task.candidate,
  });

  // Сколько дел на каждый день месяца — для точек в календаре.
  const perDay = new Map<string, { open: number; done: number }>();
  for (const task of monthTasks) {
    if (!task.dueAt) continue;
    const key = asDay(task.dueAt);
    const entry = perDay.get(key) ?? { open: 0, done: 0 };
    if (task.done) entry.done += 1;
    else entry.open += 1;
    perDay.set(key, entry);
  }

  // Сетка месяца с понедельника.
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) =>
        `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = asDay(new Date(Date.UTC(year, month - 2, 1)));
  const nextMonth = asDay(new Date(Date.UTC(year, month, 1)));

  const choices = candidates.map((candidate) => ({
    id: candidate.id,
    fullName: candidate.fullName,
    position: candidate.currentPosition,
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-strong">Блокнот</h1>
      <p className="mt-1 text-sm text-ink-soft">Ваши дела и заметки. Видны только вам.</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
        <section className="h-fit rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/notebook?day=${prevMonth}`}
              aria-label="Предыдущий месяц"
              className={buttonClass({ variant: "ghost", size: "icon-sm" })}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <p className="text-sm font-semibold text-ink-strong">
              {MONTHS[month - 1]} {year}
            </p>
            <Link
              href={`/notebook?day=${nextMonth}`}
              aria-label="Следующий месяц"
              className={buttonClass({ variant: "ghost", size: "icon-sm" })}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((name) => (
              <span key={name} className="pb-1 text-xs text-ink-soft">
                {name}
              </span>
            ))}
            {cells.map((cell, index) => {
              if (!cell) return <span key={`empty-${index}`} />;
              const counts = perDay.get(cell);
              const selected = cell === day;
              const isToday = cell === today;
              return (
                <Link
                  key={cell}
                  href={`/notebook?day=${cell}`}
                  aria-current={selected ? "date" : undefined}
                  aria-label={`${Number(cell.slice(8))} ${MONTHS_GENITIVE[month - 1]}${
                    counts?.open ? `, дел: ${counts.open}` : ""
                  }`}
                  className={`relative flex h-9 flex-col items-center justify-center rounded-lg text-sm transition ${
                    selected
                      ? "bg-ink-strong font-semibold text-canvas"
                      : isToday
                        ? "bg-glow font-semibold text-ink"
                        : "text-ink hover:bg-muted"
                  }`}
                >
                  {Number(cell.slice(8))}
                  {counts && (
                    <span
                      aria-hidden
                      className={`absolute bottom-1 h-1 w-1 rounded-full ${
                        counts.open > 0
                          ? selected
                            ? "bg-accent"
                            : "bg-accent-ink"
                          : selected
                            ? "bg-canvas/60"
                            : "bg-khaki"
                      }`}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {day !== today && (
            <Link
              href="/notebook"
              className={buttonClass({
                variant: "secondary",
                size: "sm",
                full: true,
                className: "mt-3",
              })}
            >
              Вернуться к сегодня
            </Link>
          )}
        </section>

        <div className="min-w-0 space-y-5">
          <AddTaskForm defaultDay={day} candidates={choices} />

          {overdue.length > 0 && (
            <section className="rounded-xl border border-danger-line bg-danger-soft/40 p-3">
              <h2 className="px-2 text-sm font-semibold text-danger-ink">
                Просрочено · {overdue.length}
              </h2>
              <ul className="mt-1">
                {overdue.map((task) => (
                  <TaskItem key={`${task.id}-${task.done}`} task={view(task)} today={today} />
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-line bg-surface p-3">
            <h2 className="px-2 text-sm font-semibold text-ink-strong">{dayTitle(day, today)}</h2>
            {dayTasks.length === 0 ? (
              <p className="px-2 py-3 text-sm text-ink-soft">
                На этот день ничего не запланировано.
              </p>
            ) : (
              <ul className="mt-1">
                {dayTasks.map((task) => (
                  <TaskItem key={`${task.id}-${task.done}`} task={view(task)} today={today} />
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-line bg-surface p-3">
            <h2 className="px-2 text-sm font-semibold text-ink-strong">Без даты</h2>
            {undated.length === 0 ? (
              <p className="px-2 py-3 text-sm text-ink-soft">
                Сюда попадает всё, что пока не привязано к дню.
              </p>
            ) : (
              <ul className="mt-1">
                {undated.map((task) => (
                  <TaskItem key={`${task.id}-${task.done}`} task={view(task)} today={today} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
