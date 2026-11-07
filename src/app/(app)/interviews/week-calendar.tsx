"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Wand2,
} from "lucide-react";
import {
  decideAfterInterview,
  findFreeSlots,
  rescheduleInterview,
  scheduleInterview,
  setInterviewStatus,
  type InterviewFormState,
} from "@/app/actions/interviews";
import type { Suggestion } from "@/lib/slots";
import type { CalendarDay } from "@/lib/calendar";
import { Linkify } from "@/components/linkify";
import { JoinMeetingLink, MeetingUrlField } from "@/components/meeting-url-field";
import { CANDIDATE_FORMS, plural } from "@/lib/format";
import { Modal as Dialog, useConfirm } from "@/components/ui/dialog";
import { NETWORK_ERROR, useToast } from "@/components/ui/toast";
import { ALERT_CLASSES, buttonClass, inputClass } from "@/components/ui/styles";
import { WE_DECLINED_REASONS } from "@/lib/rejection";

// Недельная сетка интервью.
//
// Всё расположение считает сервер и присылает готовым: день и минуты
// от полуночи по времени компании. Браузер только рисует — поэтому
// календарь одинаков на любом компьютере, с любыми настройками времени.

export type CalendarEvent = {
  id: string;
  candidateId: string;
  candidateName: string;
  // Должность кандидата из его карточки. В сетке важнее типа встречи:
  // по ней сразу видно, кого именно собеседуем.
  candidatePosition: string | null;
  type: string;
  typeLabel: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELED";
  statusLabel: string;
  // Решение по итогам встречи: рекомендован дальше или отказ.
  decision: "NEXT" | "REJECT" | null;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  timeText: string;
  interviewerId: string | null;
  interviewerName: string | null;
  comment: string | null;
  // Ссылка для «Подключиться» (из поля или старого комментария)
  // и значение поля формы.
  joinUrl: string | null;
  meetingUrl: string;
};

type Person = { id: string; fullName: string };
type CandidateOption = { id: string; fullName: string };

type Dialog =
  | { kind: "create"; date: string; time: string }
  | { kind: "event"; event: CalendarEvent }
  | { kind: "edit"; event: CalendarEvent }
  // Пачка встреч на одно время: сначала показываем список, из него
  // открывается конкретная встреча.
  | { kind: "group"; events: CalendarEvent[]; title: string };

// Высота получаса в пикселях. При 28 получасовая встреча занимала
// 26 пикселей, и две строки текста в неё не помещались — было видно
// только время. Теперь в самую короткую встречу влезает имя целиком.
const SLOT_HEIGHT = 44;

// Цвет блока в сетке. Решение по итогам встречи важнее её статуса:
// зелёный — рекомендован дальше, красный — отказ. Пока решения нет,
// цвет показывает состояние самой встречи.
const STATUS_STYLES: Record<CalendarEvent["status"], string> = {
  SCHEDULED: "bg-glow border-accent text-ink",
  COMPLETED: "bg-canvas border-line text-ink",
  CANCELED: "bg-muted border-line text-ink-soft line-through",
};

const DECISION_STYLES = {
  NEXT: "bg-khaki-soft border-khaki text-khaki-ink",
  REJECT: "bg-danger-soft border-danger text-danger-ink",
} as const;

// text-xs с leading-snug: 12 пикселей на 1,375.
const LINE_HEIGHT = 16.5;

function blockHeight(minutes: number): number {
  return Math.max((minutes / 30) * SLOT_HEIGHT - 3, SLOT_HEIGHT - 3);
}

// Сколько строк помещается под первой. Минус отступы сверху и снизу,
// минус сама первая строка.
function linesRoom(height: number): number {
  return Math.max(Math.floor((height - 4 - LINE_HEIGHT) / LINE_HEIGHT), 1);
}

// Строки под именем кандидата — в порядке важности: должность, тип
// встречи, интервьюер. Показываем столько, сколько влезает по высоте:
// строка текста занимает около 17 пикселей, получас — 44.
//
// Раньше тип и интервьюер были привязаны к длительности жёстко, и в
// 45-минутную встречу не попадала третья строка, хотя место под неё
// было. Теперь пустых мест не остаётся.
function extraLines(event: CalendarEvent): string[] {
  return [event.candidatePosition, event.typeLabel, event.interviewerName]
    .filter((line): line is string => Boolean(line))
    .slice(0, linesRoom(blockHeight(event.durationMinutes)));
}

// Пачка встреч, налезающих друг на друга по времени.
//
// Раньше каждая встреча рисовалась во всю ширину дня, и поставленные
// на одно время ложились ровно одна на другую: видно было только
// верхнюю, а сколько их всего — никак. На массовых вакансиях на один
// час ставят по десятку человек, поэтому такую пачку показываем одной
// плашкой: сколько человек и кто именно.
//
// Раскладывать их столбиками рядом, как в Google Calendar, здесь нельзя:
// колонка дня в недельной сетке около 95 пикселей, на двоих это уже
// по 45 — туда не помещается даже имя.
type Cluster = {
  startMinutes: number;
  endMinutes: number;
  events: CalendarEvent[];
};

function clusterEvents(dayEvents: CalendarEvent[]): Cluster[] {
  const sorted = [...dayEvents].sort((a, b) => a.startMinutes - b.startMinutes);
  const clusters: Cluster[] = [];

  for (const event of sorted) {
    const end = event.startMinutes + event.durationMinutes;
    const last = clusters[clusters.length - 1];

    // Начинается раньше, чем кончилась предыдущая пачка, — значит,
    // они наложились бы друг на друга.
    if (last && event.startMinutes < last.endMinutes) {
      last.events.push(event);
      last.endMinutes = Math.max(last.endMinutes, end);
      continue;
    }

    clusters.push({
      startMinutes: event.startMinutes,
      endMinutes: end,
      events: [event],
    });
  }

  return clusters;
}

// Имена в плашке пачки. Если все не помещаются, последняя строка
// говорит, сколько осталось за кадром.
function groupLines(events: CalendarEvent[], room: number): string[] {
  const names = events.map((event) => event.candidateName);
  if (names.length <= room) return names;

  // В получасовую плашку помещается всего одна строка. Отдавать её
  // под «+ ещё 5» бессмысленно: счётчик уже стоит в заголовке.
  // Пишем имена подряд, лишнее обрежется многоточием.
  if (room === 1) return [names.join(", ")];

  return [...names.slice(0, room - 1), `+ ещё ${names.length - room + 1}`];
}

function eventStyle(event: CalendarEvent): string {
  if (event.decision) return DECISION_STYLES[event.decision];
  return STATUS_STYLES[event.status];
}

// Короткая подпись справа в списке пачки: решение важнее статуса.
function shortResult(event: CalendarEvent): string {
  if (event.decision === "NEXT") return "дальше";
  if (event.decision === "REJECT") return "отказ";
  return event.statusLabel;
}

// Список людей, записанных на одно время. Открывается по нажатию
// на плашку пачки; отсюда открывается конкретная встреча.
function GroupList({
  events,
  onPick,
}: {
  events: CalendarEvent[];
  onPick: (event: CalendarEvent) => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-ink-soft">
        Нажмите на человека, чтобы открыть его встречу.
      </p>

      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
        {events.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => onPick(event)}
              className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-canvas"
            >
              <span className="w-12 shrink-0 font-medium text-ink">
                {event.timeText}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink">
                  {event.candidateName}
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  {event.candidatePosition ?? event.typeLabel}
                  {event.interviewerName ? ` · ${event.interviewerName}` : ""}
                </span>
              </span>

              <span
                className={`shrink-0 rounded-md border px-2 py-0.5 text-xs ${eventStyle(event)}`}
              >
                {shortResult(event)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const DURATIONS = [
  { value: "30", label: "30 минут" },
  { value: "45", label: "45 минут" },
  { value: "60", label: "1 час" },
  { value: "90", label: "1,5 часа" },
  { value: "120", label: "2 часа" },
];

const TYPES = [
  { value: "HR", label: "HR-интервью" },
  { value: "TECHNICAL", label: "Техническое интервью" },
  { value: "MANAGER", label: "Интервью с руководителем" },
  { value: "FINAL", label: "Финальное интервью" },
  { value: "OTHER", label: "Другое" },
];

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-accent";

export function WeekCalendar({
  days,
  hours,
  events,
  candidates,
  users,
  canManage,
  canDecide,
  canMoveStage,
  meetingLink,
  nowMarker,
  dayStartHour,
  dayEndHour,
}: {
  days: CalendarDay[];
  hours: { hour: number; label: string }[];
  events: CalendarEvent[];
  candidates: CandidateOption[];
  users: Person[];
  canManage: boolean;
  // Право оставить мнение по итогам встречи. Есть и у нанимающего
  // менеджера, хотя переставлять этапы он не может.
  canDecide: boolean;
  canMoveStage: boolean;
  // Постоянная ссылка компании на видеовстречу. Кнопка в форме
  // подставляет её в комментарий — без обращений к Google.
  meetingLink: string | null;
  nowMarker: { date: string; minutes: number } | null;
  dayStartHour: number;
  dayEndHour: number;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const totalMinutes = (dayEndHour - dayStartHour) * 60;
  const gridHeight = (totalMinutes / 30) * SLOT_HEIGHT;

  const slotsPerDay = Array.from(
    { length: totalMinutes / 30 },
    (_, index) => dayStartHour * 60 + index * 30,
  );

  const offsetOf = (minutes: number) =>
    ((minutes - dayStartHour * 60) / totalMinutes) * gridHeight;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <div className="min-w-[720px]">
          {/* Шапка с днями недели */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-line">
            <div />
            {days.map((day) => (
              <div
                key={day.date}
                className={`border-l border-line px-2 py-2 text-center ${
                  day.isWeekend ? "bg-canvas" : ""
                }`}
              >
                <p className="text-xs text-ink-soft">{day.weekday}</p>
                <p
                  className={`text-sm font-medium ${
                    day.isToday
                      ? "mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-ink"
                      : "text-ink"
                  }`}
                >
                  {day.dayNumber}
                </p>
              </div>
            ))}
          </div>

          {/* Сетка часов */}
          <div
            className="relative grid grid-cols-[56px_repeat(7,1fr)]"
            style={{ height: gridHeight }}
          >
            <div className="relative">
              {hours.map((item) => (
                <div
                  key={item.hour}
                  className="absolute right-2 -translate-y-1/2 text-xs text-ink-soft"
                  style={{ top: offsetOf(item.hour * 60) }}
                >
                  {item.label}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayEvents = events.filter(
                (event) => event.date === day.date,
              );

              return (
                <div
                  key={day.date}
                  className={`relative border-l border-line ${
                    day.isWeekend ? "bg-canvas" : ""
                  }`}
                >
                  {/* Линии часов */}
                  {hours.map((item) => (
                    <div
                      key={item.hour}
                      className="pointer-events-none absolute right-0 left-0 border-t border-line/70"
                      style={{ top: offsetOf(item.hour * 60) }}
                    />
                  ))}

                  {/* Пустые получасовые ячейки: нажатие назначает интервью */}
                  {canManage &&
                    slotsPerDay.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        title={`Назначить на ${minuteText(minutes)}`}
                        // Больше сотни пустых ячеек не должны стоять на пути
                        // клавиши Tab: с клавиатуры встречу назначают кнопкой
                        // «Назначить интервью» над календарём.
                        tabIndex={-1}
                        aria-hidden
                        onClick={() =>
                          setDialog({
                            kind: "create",
                            date: day.date,
                            time: minuteText(minutes),
                          })
                        }
                        className="absolute right-0 left-0 transition hover:bg-warm"
                        style={{ top: offsetOf(minutes), height: SLOT_HEIGHT }}
                      />
                    ))}

                  {/* Отметка текущего времени */}
                  {nowMarker && nowMarker.date === day.date && (
                    <div
                      className="pointer-events-none absolute right-0 left-0 z-10 border-t-2 border-danger"
                      style={{ top: offsetOf(nowMarker.minutes) }}
                    >
                      <span className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-danger" />
                    </div>
                  )}

                  {/* Сами интервью. Наложенные друг на друга по времени
                      идут одной плашкой — иначе в сетке видно только
                      верхнюю из них. */}
                  {clusterEvents(dayEvents).map((cluster) => {
                    const single =
                      cluster.events.length === 1 ? cluster.events[0] : null;

                    const height = blockHeight(
                      single
                        ? single.durationMinutes
                        : cluster.endMinutes - cluster.startMinutes,
                    );

                    if (single) {
                      return (
                        <button
                          key={single.id}
                          type="button"
                          onClick={() =>
                            setDialog({ kind: "event", event: single })
                          }
                          className={`absolute right-1 left-1 z-20 overflow-hidden rounded-md border px-2 py-0.5 text-left text-xs leading-snug transition hover:brightness-95 ${eventStyle(single)}`}
                          style={{
                            top: offsetOf(single.startMinutes),
                            height,
                          }}
                        >
                          <span className="block truncate font-medium">
                            {single.timeText} {single.candidateName}
                          </span>

                          {extraLines(single).map((line, index) => (
                            <span
                              key={line}
                              className={`block truncate ${index === 0 ? "opacity-80" : "opacity-70"}`}
                            >
                              {line}
                            </span>
                          ))}
                        </button>
                      );
                    }

                    const count = cluster.events.length;
                    const title = `${cluster.events[0].timeText} · ${count} ${plural(count, CANDIDATE_FORMS)}`;

                    return (
                      <button
                        key={`${day.date}-${cluster.startMinutes}`}
                        type="button"
                        onClick={() =>
                          setDialog({
                            kind: "group",
                            events: cluster.events,
                            title,
                          })
                        }
                        title={title}
                        className="absolute right-1 left-1 z-20 overflow-hidden rounded-md border border-ink-soft bg-surface px-2 py-0.5 text-left text-xs leading-snug text-ink shadow-sm transition hover:brightness-95"
                        style={{ top: offsetOf(cluster.startMinutes), height }}
                      >
                        {/* Число вынесено в значок и не сжимается: колонка
                            дня узкая, и подпись «5 кандидатов» в ней
                            обрезалась ровно на самом важном месте. */}
                        <span className="flex items-center justify-between gap-1 font-semibold">
                          <span className="truncate">
                            {cluster.events[0].timeText}
                          </span>
                          <span className="shrink-0 rounded bg-ink-strong px-1 text-xs leading-4 text-canvas">
                            {count}
                          </span>
                        </span>

                        {groupLines(cluster.events, linesRoom(height)).map(
                          (line, index) => (
                            <span
                              key={`${line}-${index}`}
                              className="block truncate opacity-75"
                            >
                              {line}
                            </span>
                          ),
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {dialog?.kind === "create" && (
        <Modal title="Назначить интервью" onClose={() => setDialog(null)}>
          <InterviewForm
            mode="create"
            candidates={candidates}
            users={users}
            defaults={{
              candidateId: "",
              type: "HR",
              date: dialog.date,
              time: dialog.time,
              durationMinutes: "60",
              interviewerId: "",
              comment: "",
              meetingUrl: "",
            }}
            meetingLink={meetingLink}
            onDone={() => setDialog(null)}
          />
        </Modal>
      )}

      {dialog?.kind === "edit" && (
        <Modal title="Изменить интервью" onClose={() => setDialog(null)}>
          <InterviewForm
            mode="edit"
            interviewId={dialog.event.id}
            candidates={candidates}
            users={users}
            defaults={{
              candidateId: dialog.event.candidateId,
              type: dialog.event.type,
              date: dialog.event.date,
              time: minuteText(dialog.event.startMinutes),
              durationMinutes: String(dialog.event.durationMinutes),
              interviewerId: dialog.event.interviewerId ?? "",
              comment: dialog.event.comment ?? "",
              meetingUrl: dialog.event.meetingUrl,
            }}
            meetingLink={meetingLink}
            onDone={() => setDialog(null)}
          />
        </Modal>
      )}

      {dialog?.kind === "group" && (
        <Modal title={dialog.title} onClose={() => setDialog(null)}>
          <GroupList
            events={dialog.events}
            onPick={(event) => setDialog({ kind: "event", event })}
          />
        </Modal>
      )}

      {dialog?.kind === "event" && (
        <Modal
          title={dialog.event.candidateName}
          onClose={() => setDialog(null)}
        >
          <EventDetails
            event={dialog.event}
            canManage={canManage}
            canDecide={canDecide}
            canMoveStage={canMoveStage}
            onEdit={() => setDialog({ kind: "edit", event: dialog.event })}
            onDone={() => setDialog(null)}
          />
        </Modal>
      )}

      {canManage && (
        <button
          type="button"
          onClick={() =>
            setDialog({
              kind: "create",
              date: days[0].date,
              time: "10:00",
            })
          }
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Назначить интервью
        </button>
      )}
    </>
  );
}

function minuteText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

// Окна календаря — общее окно LAMP: закрывается по Esc,
// держит фокус внутри и понятно экранному диктору.
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog open onClose={onClose} title={title}>
      {children}
    </Dialog>
  );
}

function EventDetails({
  event,
  canManage,
  canDecide,
  canMoveStage,
  onEdit,
  onDone,
}: {
  event: CalendarEvent;
  canManage: boolean;
  canDecide: boolean;
  canMoveStage: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Отказ — в два шага: сначала причина, потом подтверждение.
  // Раньше кандидат уходил в отказ с одного нажатия.
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  // Решение по итогам встречи. Записывает мнение в отзывы, закрывает
  // интервью и двигает кандидата — дальше по воронке или в отказ.
  function decide(decision: "NEXT" | "REJECT") {
    const formData = new FormData();
    formData.set("interviewId", event.id);
    formData.set("decision", decision);
    formData.set("comment", comment);
    if (decision === "REJECT" && reason) {
      formData.set("rejectionReason", reason);
    }

    startTransition(async () => {
      try {
        const result = await decideAfterInterview(formData);

        if (result.formError) {
          setError(result.formError);
          return;
        }

        toast.success(
          decision === "NEXT"
            ? "Решение записано: рекомендован дальше"
            : "Решение записано: отказ",
        );
        onDone();
        router.refresh();
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  async function changeStatus(status: string) {
    if (status === "CANCELED") {
      const confirmed = await confirm({
        title: "Отменить встречу?",
        message: `${event.candidateName} — ${event.timeText}. Встреча останется в истории как отменённая.`,
        confirmLabel: "Отменить встречу",
        cancelLabel: "Не отменять",
        danger: true,
      });
      if (!confirmed) return;
    }

    const formData = new FormData();
    formData.set("interviewId", event.id);
    formData.set("status", status);

    startTransition(async () => {
      try {
        await setInterviewStatus(formData);
        toast.success(status === "CANCELED" ? "Встреча отменена" : "Встреча отмечена проведённой");
        onDone();
        router.refresh();
      } catch {
        toast.error(NETWORK_ERROR);
      }
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-line bg-canvas p-3">
        {/* В заголовке окна стоит имя, поэтому должность идёт первой
            строкой: без неё непонятно, на какую роль человек идёт. */}
        {event.candidatePosition && (
          <p className="mb-1 text-ink">{event.candidatePosition}</p>
        )}

        <p className="text-ink">{event.typeLabel}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {event.timeText} · {event.durationMinutes} минут · {event.statusLabel}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          Интервьюер: {event.interviewerName ?? "не назначен"}
        </p>
        {event.comment && (
          <p className="mt-2 text-xs whitespace-pre-wrap text-ink-soft">
            <Linkify text={event.comment} />
          </p>
        )}
        {event.status === "SCHEDULED" && event.joinUrl && (
          <div className="mt-2">
            <JoinMeetingLink url={event.joinUrl} />
          </div>
        )}
      </div>

      {event.decision && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${DECISION_STYLES[event.decision]}`}
        >
          {event.decision === "NEXT"
            ? "Рекомендован на следующий этап"
            : "Отказ по итогам встречи"}
        </p>
      )}

      {canDecide && !event.decision && (
        <div className="rounded-lg border border-line bg-canvas p-3">
          <p className="text-sm font-medium text-ink">Итог встречи</p>
          <p className="mt-1 text-xs text-ink-soft">
            {canMoveStage
              ? "Решение попадёт в отзывы кандидата, встреча отметится проведённой, а кандидат перейдёт дальше по воронке или в отказ."
              : "Решение попадёт в отзывы кандидата, а встреча отметится проведённой. Этап меняет рекрутер."}
          </p>

          {error && (
            <p role="alert" className={`mt-2 ${ALERT_CLASSES.danger}`}>
              {error}
            </p>
          )}

          <textarea
            value={comment}
            onChange={(field) => setComment(field.target.value)}
            rows={2}
            placeholder="Пара слов — по желанию"
            aria-label="Комментарий к решению"
            className={inputClass(false, "mt-2")}
          />

          {rejecting ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-ink">
                Причина отказа
              </p>
              <p className="text-xs text-ink-soft">
                Пригодится в аналитике. Можно не выбирать.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WE_DECLINED_REASONS.map((item) => {
                  const chosen = reason === item.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => setReason(chosen ? "" : item.code)}
                      className={`inline-flex min-h-9 items-center rounded-lg border px-3 py-1.5 text-left text-sm transition ${
                        chosen
                          ? "border-danger bg-danger-soft font-medium text-danger-ink"
                          : "border-line-strong bg-surface text-ink hover:bg-canvas"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRejecting(false);
                    setReason("");
                  }}
                  disabled={pending}
                  className={buttonClass({ variant: "secondary" })}
                >
                  Назад
                </button>
                <button
                  type="button"
                  onClick={() => decide("REJECT")}
                  disabled={pending}
                  className={buttonClass({ variant: "danger" })}
                >
                  <ThumbsDown className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Подтвердить отказ
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => decide("NEXT")}
                disabled={pending}
                className={buttonClass({ variant: "positive", className: "flex-1" })}
              >
                <ThumbsUp className="h-4 w-4" strokeWidth={2} aria-hidden />
                Рекомендую дальше
              </button>
              <button
                type="button"
                onClick={() => setRejecting(true)}
                disabled={pending}
                className={buttonClass({ variant: "danger-outline" })}
              >
                <ThumbsDown className="h-4 w-4" strokeWidth={2} aria-hidden />
                Отказ
              </button>
            </div>
          )}
        </div>
      )}

      <Link
        href={`/candidates/${event.candidateId}`}
        className={buttonClass({ variant: "secondary", full: true })}
      >
        Открыть карточку кандидата
      </Link>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={pending}
            className={buttonClass({ variant: "primary", className: "flex-1" })}
          >
            {/* Не «Перенести»: за этой кнопкой меняется всё — тип, время,
                интервьюер и комментарий со ссылкой на встречу. По старому
                названию догадаться об этом было нельзя. */}
            Изменить
          </button>

          {event.status !== "COMPLETED" && (
            <button
              type="button"
              onClick={() => changeStatus("COMPLETED")}
              disabled={pending}
              className={buttonClass({ variant: "secondary" })}
            >
              Проведено
            </button>
          )}

          {event.status !== "CANCELED" && (
            <button
              type="button"
              onClick={() => changeStatus("CANCELED")}
              disabled={pending}
              className={buttonClass({ variant: "danger-outline" })}
            >
              Отменить встречу
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InterviewForm({
  mode,
  interviewId,
  candidates,
  users,
  meetingLink,
  defaults,
  onDone,
}: {
  mode: "create" | "edit";
  interviewId?: string;
  candidates: CandidateOption[];
  users: Person[];
  meetingLink: string | null;
  defaults: {
    candidateId: string;
    type: string;
    date: string;
    time: string;
    durationMinutes: string;
    interviewerId: string;
    comment: string;
    meetingUrl: string;
  };
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<InterviewFormState>({});

  // Поля, от которых зависит автоподбор, держим в состоянии.
  const [candidateId, setCandidateId] = useState(defaults.candidateId);
  const [interviewerId, setInterviewerId] = useState(defaults.interviewerId);
  const [duration, setDuration] = useState(defaults.durationMinutes);
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);

  const [slots, setSlots] = useState<Suggestion[] | null>(null);
  const [searching, startSearch] = useTransition();

  function pickTime() {
    startSearch(async () => {
      const found = await findFreeSlots({
        interviewerId: interviewerId || null,
        candidateId: candidateId || null,
        durationMinutes: Number(duration) || null,
      });
      setSlots(found);
    });
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await scheduleInterview({}, formData)
          : await rescheduleInterview({}, formData);

      if (result.success) {
        onDone();
        router.refresh();
        return;
      }

      setState(result);
    });
  }

  return (
    <form action={submit} className="space-y-3">
      {interviewId && (
        <input type="hidden" name="interviewId" value={interviewId} />
      )}

      {state.formError && (
        <div className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.formError}
        </div>
      )}

      {mode === "create" ? (
        <div>
          <label
            htmlFor="cal-candidate"
            className="block text-sm font-medium text-ink"
          >
            Кандидат
          </label>
          <select
            id="cal-candidate"
            name="candidateId"
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Выберите кандидата</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.fullName}
              </option>
            ))}
          </select>
          {state.fieldErrors?.candidateId && (
            <p className="mt-1.5 text-xs text-danger">
              {state.fieldErrors.candidateId}
            </p>
          )}
        </div>
      ) : (
        <input type="hidden" name="candidateId" value={candidateId} />
      )}

      <div>
        <label
          htmlFor="cal-type"
          className="block text-sm font-medium text-ink"
        >
          Тип интервью
        </label>
        <select
          id="cal-type"
          name="type"
          defaultValue={defaults.type}
          className={fieldClass}
        >
          {TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="cal-date"
            className="block text-sm font-medium text-ink"
          >
            Дата
          </label>
          <input
            id="cal-date"
            name="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label
            htmlFor="cal-time"
            className="block text-sm font-medium text-ink"
          >
            Время
          </label>
          <input
            id="cal-time"
            name="time"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className={fieldClass}
          />
        </div>
      </div>
      {state.fieldErrors?.date && (
        <p className="text-xs text-danger">{state.fieldErrors.date}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="cal-duration"
            className="block text-sm font-medium text-ink"
          >
            Длительность
          </label>
          <select
            id="cal-duration"
            name="durationMinutes"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            className={fieldClass}
          >
            {DURATIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="cal-interviewer"
            className="block text-sm font-medium text-ink"
          >
            Интервьюер
          </label>
          <select
            id="cal-interviewer"
            name="interviewerId"
            value={interviewerId}
            onChange={(event) => setInterviewerId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Не назначен</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Автоподбор: система смотрит, когда оба свободны */}
      <div className="rounded-lg border border-line bg-canvas p-3">
        <button
          type="button"
          onClick={pickTime}
          disabled={searching}
          className="inline-flex items-center gap-2 text-sm text-ink transition hover:text-ink-strong disabled:opacity-60"
        >
          <Wand2 className="h-4 w-4" strokeWidth={1.8} />
          {searching ? "Ищем окна…" : "Подобрать время"}
        </button>

        <p className="mt-1 text-xs text-ink-soft">
          Ближайшие свободные окна в будни с 10:00 до 19:00 — с учётом того, что
          уже назначено этому кандидату и интервьюеру.
        </p>

        {slots && slots.length === 0 && (
          <p className="mt-2 text-xs text-ink-soft">
            Свободных окон на ближайшие три недели не нашлось.
          </p>
        )}

        {slots && slots.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {slots.map((slot) => {
              const chosen = slot.date === date && slot.time === time;

              return (
                <button
                  key={`${slot.date}-${slot.time}`}
                  type="button"
                  onClick={() => {
                    setDate(slot.date);
                    setTime(slot.time);
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                    chosen
                      ? "border-khaki bg-khaki-soft text-khaki-ink"
                      : "border-line bg-surface text-ink-soft hover:border-ink-soft hover:text-ink"
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="cal-comment"
          className="block text-sm font-medium text-ink"
        >
          Комментарий
        </label>
        <textarea
          id="cal-comment"
          name="comment"
          rows={2}
          defaultValue={defaults.comment}
          placeholder="Адрес офиса, о чём спросить"
          className={fieldClass}
        />
      </div>

      <MeetingUrlField
        id="cal-meetingUrl"
        defaultValue={defaults.meetingUrl}
        companyLink={meetingLink}
        error={state.fieldErrors?.meetingUrl}
      />

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-hover disabled:opacity-60"
      >
        <CalendarClock className="h-4 w-4" strokeWidth={2} />
        {pending ? "Сохраняем…" : mode === "create" ? "Назначить" : "Сохранить"}
      </button>
    </form>
  );
}
