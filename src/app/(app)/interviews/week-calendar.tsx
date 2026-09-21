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
  X,
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

// Недельная сетка интервью.
//
// Всё расположение считает сервер и присылает готовым: день и минуты
// от полуночи по времени компании. Браузер только рисует — поэтому
// календарь одинаков на любом компьютере, с любыми настройками времени.

export type CalendarEvent = {
  id: string;
  candidateId: string;
  candidateName: string;
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
};

type Person = { id: string; fullName: string };
type CandidateOption = { id: string; fullName: string };

type Dialog =
  | { kind: "create"; date: string; time: string }
  | { kind: "event"; event: CalendarEvent }
  | { kind: "edit"; event: CalendarEvent };

// Высота получаса в пикселях. При 28 получасовая встреча занимала
// 26 пикселей, и две строки текста в неё не помещались — было видно
// только время. Теперь в самую короткую встречу влезает имя целиком.
const SLOT_HEIGHT = 44;

// Цвет блока в сетке. Решение по итогам встречи важнее её статуса:
// зелёный — рекомендован дальше, красный — отказ. Пока решения нет,
// цвет показывает состояние самой встречи.
const STATUS_STYLES: Record<CalendarEvent["status"], string> = {
  SCHEDULED: "bg-accent/30 border-accent/60 text-ink",
  COMPLETED: "bg-canvas border-muted text-ink",
  CANCELED: "bg-muted border-muted text-ink-soft line-through",
};

const DECISION_STYLES = {
  NEXT: "bg-green-100 border-green-400 text-green-900",
  REJECT: "bg-red-100 border-red-400 text-red-900",
} as const;

function eventStyle(event: CalendarEvent): string {
  if (event.decision) return DECISION_STYLES[event.decision];
  return STATUS_STYLES[event.status];
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
  "mt-1.5 w-full rounded-lg border border-muted bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30";

export function WeekCalendar({
  days,
  hours,
  events,
  candidates,
  users,
  canManage,
  canDecide,
  canMoveStage,
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
      <div className="overflow-x-auto rounded-xl border border-muted bg-surface">
        <div className="min-w-[720px]">
          {/* Шапка с днями недели */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-muted">
            <div />
            {days.map((day) => (
              <div
                key={day.date}
                className={`border-l border-muted px-2 py-2 text-center ${
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
                  className={`relative border-l border-muted ${
                    day.isWeekend ? "bg-canvas" : ""
                  }`}
                >
                  {/* Линии часов */}
                  {hours.map((item) => (
                    <div
                      key={item.hour}
                      className="pointer-events-none absolute right-0 left-0 border-t border-muted/70"
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
                        onClick={() =>
                          setDialog({
                            kind: "create",
                            date: day.date,
                            time: minuteText(minutes),
                          })
                        }
                        className="absolute right-0 left-0 transition hover:bg-accent/10"
                        style={{ top: offsetOf(minutes), height: SLOT_HEIGHT }}
                      />
                    ))}

                  {/* Отметка текущего времени */}
                  {nowMarker && nowMarker.date === day.date && (
                    <div
                      className="pointer-events-none absolute right-0 left-0 z-10 border-t-2 border-red-500"
                      style={{ top: offsetOf(nowMarker.minutes) }}
                    >
                      <span className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-red-500" />
                    </div>
                  )}

                  {/* Сами интервью */}
                  {dayEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setDialog({ kind: "event", event })}
                      className={`absolute right-1 left-1 z-20 overflow-hidden rounded-md border px-2 py-0.5 text-left text-xs leading-snug transition hover:brightness-95 ${eventStyle(event)}`}
                      style={{
                        top: offsetOf(event.startMinutes),
                        height: Math.max(
                          (event.durationMinutes / 30) * SLOT_HEIGHT - 3,
                          SLOT_HEIGHT - 3,
                        ),
                      }}
                    >
                      <span className="block truncate font-medium">
                        {event.timeText} {event.candidateName}
                      </span>
                      <span className="block truncate opacity-80">
                        {event.typeLabel}
                      </span>
                      {/* На встречу от часа остаётся место на третью строку */}
                      {event.durationMinutes >= 60 && event.interviewerName && (
                        <span className="block truncate opacity-70">
                          {event.interviewerName}
                        </span>
                      )}
                    </button>
                  ))}
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
            }}
            onDone={() => setDialog(null)}
          />
        </Modal>
      )}

      {dialog?.kind === "edit" && (
        <Modal title="Перенести интервью" onClose={() => setDialog(null)}>
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
            }}
            onDone={() => setDialog(null)}
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-strong/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-muted bg-surface p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-medium text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="text-ink-soft transition hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
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
  const router = useRouter();

  // Решение по итогам встречи. Записывает мнение в фидбэки, закрывает
  // интервью и двигает кандидата — дальше по воронке или в отказ.
  function decide(decision: "NEXT" | "REJECT") {
    const formData = new FormData();
    formData.set("interviewId", event.id);
    formData.set("decision", decision);
    formData.set("comment", comment);

    startTransition(async () => {
      const result = await decideAfterInterview(formData);

      if (result.formError) {
        setError(result.formError);
        return;
      }

      onDone();
      router.refresh();
    });
  }

  function changeStatus(status: string) {
    const formData = new FormData();
    formData.set("interviewId", event.id);
    formData.set("status", status);

    startTransition(async () => {
      await setInterviewStatus(formData);
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-muted bg-canvas p-3">
        <p className="text-ink">{event.typeLabel}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {event.timeText} · {event.durationMinutes} минут · {event.statusLabel}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          Интервьюер: {event.interviewerName ?? "не назначен"}
        </p>
        {event.comment && (
          <p className="mt-2 text-xs text-ink-soft">{event.comment}</p>
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
        <div className="rounded-lg border border-muted bg-canvas p-3">
          <p className="text-sm font-medium text-ink">Итог встречи</p>
          <p className="mt-1 text-xs text-ink-soft">
            {canMoveStage
              ? "Решение попадёт в фидбэки кандидата, встреча отметится проведённой, а кандидат перейдёт дальше по воронке или в отказ."
              : "Решение попадёт в фидбэки кандидата, а встреча отметится проведённой. Этап меняет рекрутер."}
          </p>

          {error && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <textarea
            value={comment}
            onChange={(field) => setComment(field.target.value)}
            rows={2}
            placeholder="Пара слов — по желанию"
            aria-label="Комментарий к решению"
            className="mt-2 w-full rounded-lg border border-muted bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/30"
          />

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => decide("NEXT")}
              disabled={pending}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
            >
              <ThumbsUp className="h-4 w-4" strokeWidth={2} />
              Рекомендую дальше
            </button>
            <button
              type="button"
              onClick={() => decide("REJECT")}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
            >
              <ThumbsDown className="h-4 w-4" strokeWidth={2} />
              Отказ
            </button>
          </div>
        </div>
      )}

      <Link
        href={`/candidates/${event.candidateId}`}
        className="block rounded-lg border border-muted px-3 py-2 text-center text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
      >
        Открыть карточку кандидата
      </Link>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={pending}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            Перенести
          </button>

          {event.status !== "COMPLETED" && (
            <button
              type="button"
              onClick={() => changeStatus("COMPLETED")}
              disabled={pending}
              className="rounded-lg border border-muted px-3 py-2 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink disabled:opacity-60"
            >
              Проведено
            </button>
          )}

          {event.status !== "CANCELED" && (
            <button
              type="button"
              onClick={() => changeStatus("CANCELED")}
              disabled={pending}
              className="rounded-lg border border-muted px-3 py-2 text-sm text-ink-soft transition hover:border-red-300 hover:text-red-600 disabled:opacity-60"
            >
              Отменить
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
  defaults,
  onDone,
}: {
  mode: "create" | "edit";
  interviewId?: string;
  candidates: CandidateOption[];
  users: Person[];
  defaults: {
    candidateId: string;
    type: string;
    date: string;
    time: string;
    durationMinutes: string;
    interviewerId: string;
    comment: string;
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
            <p className="mt-1.5 text-xs text-red-600">
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
        <p className="text-xs text-red-600">{state.fieldErrors.date}</p>
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
      <div className="rounded-lg border border-muted bg-canvas p-3">
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
                      ? "border-accent bg-accent/25 text-ink"
                      : "border-muted bg-surface text-ink-soft hover:border-ink-soft hover:text-ink"
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
          placeholder="Ссылка на встречу, адрес офиса"
          className={fieldClass}
        />
      </div>

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
