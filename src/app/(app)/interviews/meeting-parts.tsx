"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Clock, Users, Video, X } from "lucide-react";
import { cancelMeeting, createMeeting, respondToMeeting } from "@/app/actions/meetings";
import { ALERT_CLASSES, buttonClass, inputClass, LABEL_CLASS } from "@/components/ui/styles";
import { NETWORK_ERROR, useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/dialog";
import { Linkify } from "@/components/linkify";
import { Select } from "@/components/ui/select";

// Собрания и напоминания в календаре интервью.

export type AttendeeState = "PENDING" | "ACCEPTED" | "DECLINED";

export type CalendarMeeting = {
  id: string;
  kind: "DAILY" | "REMINDER";
  title: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  timeText: string;
  meetingUrl: string | null;
  comment: string | null;
  organizerName: string;
  isOrganizer: boolean;
  // Мой ответ на приглашение.
  myStatus: AttendeeState;
  attendees: { id: string; name: string; status: AttendeeState }[];
};

type Person = { id: string; fullName: string };

const DURATIONS = [
  { value: "15", label: "15 минут" },
  { value: "30", label: "30 минут" },
  { value: "45", label: "45 минут" },
  { value: "60", label: "1 час" },
  { value: "90", label: "1,5 часа" },
  { value: "120", label: "2 часа" },
];

const STATUS_TEXT: Record<AttendeeState, string> = {
  PENDING: "ещё не ответил(а)",
  ACCEPTED: "придёт",
  DECLINED: "не сможет",
};

// Цвет блока в сетке: пока не ответил — серый и пунктиром,
// принял — синий (собрание) или сиреневый (напоминание).
export function meetingStyle(meeting: CalendarMeeting): string {
  if (meeting.myStatus === "PENDING") {
    return "border-dashed border-ink-faint bg-muted text-ink-soft";
  }
  return meeting.kind === "REMINDER"
    ? "border-referral-line bg-referral-soft text-referral-ink"
    : "border-cold-line bg-cold-soft text-cold-ink";
}

// Кнопки «Иду» / «Не смогу» — в календаре и в уведомлениях.
export function MeetingAnswerButtons({
  meetingId,
  status,
  onDone,
}: {
  meetingId: string;
  status: AttendeeState;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(status);
  const router = useRouter();
  const toast = useToast();

  function answer(next: "ACCEPTED" | "DECLINED") {
    const formData = new FormData();
    formData.set("meetingId", meetingId);
    formData.set("answer", next);
    startTransition(async () => {
      try {
        const result = await respondToMeeting(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setCurrent(next);
        if (result.message) toast.success(result.message);
        router.refresh();
        onDone?.();
      } catch {
        toast.error(NETWORK_ERROR);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || current === "ACCEPTED"}
        onClick={() => answer("ACCEPTED")}
        className={buttonClass({
          variant: current === "ACCEPTED" ? "positive" : "secondary",
          size: "sm",
        })}
      >
        <Check className="size-4" strokeWidth={2} aria-hidden />
        {current === "ACCEPTED" ? "Вы идёте" : "Иду"}
      </button>
      <button
        type="button"
        disabled={pending || current === "DECLINED"}
        onClick={() => answer("DECLINED")}
        className={buttonClass({
          variant: current === "DECLINED" ? "danger-outline" : "secondary",
          size: "sm",
        })}
      >
        <X className="size-4" strokeWidth={2} aria-hidden />
        {current === "DECLINED" ? "Вы отказались" : "Не смогу"}
      </button>
    </div>
  );
}

export function MeetingDetails({
  meeting,
  onDone,
}: {
  meeting: CalendarMeeting;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  async function cancel() {
    const ok = await confirm({
      title: meeting.kind === "DAILY" ? "Отменить собрание?" : "Удалить напоминание?",
      message:
        meeting.kind === "DAILY" ? "Участники получат уведомление об отмене." : undefined,
      confirmLabel: meeting.kind === "DAILY" ? "Отменить собрание" : "Удалить",
    });
    if (!ok) return;
    const formData = new FormData();
    formData.set("meetingId", meeting.id);
    startTransition(async () => {
      try {
        const result = await cancelMeeting(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Готово");
        router.refresh();
        onDone();
      } catch {
        toast.error(NETWORK_ERROR);
      }
    });
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="flex items-center gap-2 text-ink">
        <Clock className="size-4 text-ink-soft" strokeWidth={1.8} aria-hidden />
        {meeting.date.split("-").reverse().join(".")}, {meeting.timeText} ·{" "}
        {meeting.durationMinutes} мин
      </p>

      {meeting.kind === "DAILY" && (
        <div>
          <p className="flex items-center gap-2 font-medium text-ink">
            <Users className="size-4 text-ink-soft" strokeWidth={1.8} aria-hidden />
            Участники
          </p>
          <ul className="mt-1.5 space-y-1 pl-6">
            {meeting.attendees.map((person) => (
              <li key={person.id} className="flex justify-between gap-3">
                <span className="text-ink">{person.name}</span>
                <span
                  className={
                    person.status === "ACCEPTED"
                      ? "text-success-ink"
                      : person.status === "DECLINED"
                        ? "text-danger"
                        : "text-ink-soft"
                  }
                >
                  {STATUS_TEXT[person.status]}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 pl-6 text-xs text-ink-soft">
            Назначил(а): {meeting.organizerName}
          </p>
        </div>
      )}

      {meeting.comment && (
        <p className="whitespace-pre-line text-ink-soft">
          <Linkify text={meeting.comment} />
        </p>
      )}

      {meeting.meetingUrl && (
        <a
          href={meeting.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ variant: "primary", size: "sm" })}
        >
          <Video className="size-4" strokeWidth={1.8} aria-hidden />
          Подключиться
        </a>
      )}

      {!meeting.isOrganizer && (
        <div className="border-t border-line pt-3">
          <p className="mb-2 text-xs text-ink-soft">
            {meeting.myStatus === "PENDING"
              ? "Вы ещё не ответили на приглашение"
              : "Ваш ответ"}
          </p>
          <MeetingAnswerButtons
            meetingId={meeting.id}
            status={meeting.myStatus}
            onDone={onDone}
          />
        </div>
      )}

      {meeting.isOrganizer && (
        <div className="border-t border-line pt-3">
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className={buttonClass({ variant: "danger-outline", size: "sm" })}
          >
            {meeting.kind === "DAILY" ? "Отменить собрание" : "Удалить напоминание"}
          </button>
        </div>
      )}
    </div>
  );
}

export function MeetingForm({
  kind,
  date,
  time,
  colleagues,
  onDone,
}: {
  kind: "DAILY" | "REMINDER";
  date: string;
  time: string;
  colleagues: Person[];
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function submit(formData: FormData) {
    formData.set("kind", kind);
    for (const id of picked) formData.append("attendeeIds", id);
    startTransition(async () => {
      try {
        const result = await createMeeting(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(result.message ?? "Готово");
        router.refresh();
        onDone();
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  const toggle = (id: string) =>
    setPicked((list) =>
      list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
    );

  return (
    <form action={submit} className="space-y-3">
      {error && <div className={ALERT_CLASSES.danger}>{error}</div>}

      <div>
        <label htmlFor="meeting-title" className={LABEL_CLASS}>
          {kind === "DAILY" ? "Тема собрания" : "О чём напомнить"}
        </label>
        <input
          id="meeting-title"
          name="title"
          required
          maxLength={200}
          placeholder={
            kind === "DAILY" ? "Дэйлик отдела подбора" : "Позвонить заказчику по вакансии"
          }
          className={inputClass(false, "mt-1.5")}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="meeting-date" className={LABEL_CLASS}>
            Дата
          </label>
          <input
            id="meeting-date"
            name="date"
            type="date"
            required
            defaultValue={date}
            className={inputClass(false, "mt-1.5")}
          />
        </div>
        <div>
          <label htmlFor="meeting-time" className={LABEL_CLASS}>
            Время
          </label>
          <input
            id="meeting-time"
            name="time"
            type="time"
            required
            defaultValue={time}
            className={inputClass(false, "mt-1.5")}
          />
        </div>
        <div>
          <span className={LABEL_CLASS}>Длительность</span>
          <Select
            name="durationMinutes"
            defaultValue={kind === "DAILY" ? "30" : "15"}
            options={DURATIONS}
            label="Длительность"
            className="mt-1.5"
          />
        </div>
      </div>

      {kind === "DAILY" && (
        <fieldset>
          <legend className={LABEL_CLASS}>Кого позвать</legend>
          {colleagues.length === 0 ? (
            <p className="mt-1.5 text-sm text-ink-soft">
              В компании пока нет других сотрудников.
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {colleagues.map((person) => {
                const on = picked.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(person.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${
                      on
                        ? "border-cold-line bg-cold-soft text-cold-ink"
                        : "border-line text-ink-soft hover:border-ink-soft hover:text-ink"
                    }`}
                  >
                    {on && <Check className="size-3.5" strokeWidth={2.2} aria-hidden />}
                    {person.fullName}
                  </button>
                );
              })}
            </div>
          )}
          {colleagues.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setPicked(
                  picked.length === colleagues.length
                    ? []
                    : colleagues.map((person) => person.id),
                )
              }
              className="mt-2 text-xs text-ink-soft underline hover:text-ink"
            >
              {picked.length === colleagues.length ? "Снять всех" : "Позвать всех"}
            </button>
          )}
          <p className="mt-1.5 text-xs text-ink-soft">
            Каждый получит уведомление и ответит «Иду» или «Не смогу». Пока ответа
            нет, встреча у него в календаре серая.
          </p>
        </fieldset>
      )}

      {kind === "DAILY" && (
        <div>
          <label htmlFor="meeting-url" className={LABEL_CLASS}>
            Ссылка на встречу — необязательно
          </label>
          <input
            id="meeting-url"
            name="meetingUrl"
            inputMode="url"
            placeholder="https://meet.google.com/abc-defg-hij"
            className={inputClass(false, "mt-1.5")}
          />
        </div>
      )}

      <div>
        <label htmlFor="meeting-comment" className={LABEL_CLASS}>
          Комментарий — необязательно
        </label>
        <textarea
          id="meeting-comment"
          name="comment"
          rows={2}
          className={inputClass(false, "mt-1.5")}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className={buttonClass({ variant: "primary", full: true })}
      >
        {kind === "DAILY" ? (
          <>
            <Users className="size-4" strokeWidth={1.8} aria-hidden />
            {pending ? "Отправляем приглашения…" : "Назначить собрание"}
          </>
        ) : (
          <>
            <Bell className="size-4" strokeWidth={1.8} aria-hidden />
            {pending ? "Сохраняем…" : "Добавить напоминание"}
          </>
        )}
      </button>
    </form>
  );
}
