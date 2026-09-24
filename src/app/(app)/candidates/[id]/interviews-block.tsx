"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Check, Pencil, X } from "lucide-react";
import {
  createInterview,
  rescheduleInterview,
  setInterviewStatus,
  type InterviewFormState,
} from "@/app/actions/interviews";
import { TextField } from "@/components/ui/text-field";
import { SelectField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { MeetingLinkButton } from "@/components/meeting-link-button";
import { Linkify } from "@/components/linkify";

// Интервью кандидата: список, форма назначения и изменение уже
// назначенного. Даты приходят уже отформатированными с сервера — так
// не бывает расхождений часовых поясов между сервером и браузером.
//
// Рядом с подписями («23.09.2026, 10:00») приходят и сами значения
// (date, time, durationMinutes): подписью поле формы не заполнить.

export type InterviewView = {
  id: string;
  typeLabel: string;
  statusLabel: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELED";
  whenText: string;
  durationText: string | null;
  interviewerName: string | null;
  comment: string | null;

  type: string;
  date: string;
  time: string;
  durationMinutes: string;
  interviewerId: string;
};

type Person = { id: string; fullName: string };

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-accent/25 text-ink",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELED: "bg-muted text-ink-soft",
};

const TYPE_OPTIONS = [
  { value: "HR", label: "HR-интервью" },
  { value: "TECHNICAL", label: "Техническое интервью" },
  { value: "MANAGER", label: "Интервью с руководителем" },
  { value: "FINAL", label: "Финальное интервью" },
  { value: "OTHER", label: "Другое" },
];

const DURATION_OPTIONS = [
  { value: "30", label: "30 минут" },
  { value: "45", label: "45 минут" },
  { value: "60", label: "1 час" },
  { value: "90", label: "1,5 часа" },
  { value: "120", label: "2 часа" },
];

// Поля у назначения и у изменения одни и те же, поэтому живут в одном
// месте: иначе новая настройка появлялась бы только в одной из форм.
function InterviewFields({
  defaults,
  users,
  meetingLink,
  errors,
}: {
  defaults: {
    type: string;
    date: string;
    time: string;
    durationMinutes: string;
    interviewerId: string;
    comment: string;
  };
  users: Person[];
  meetingLink: string | null;
  errors: InterviewFormState["fieldErrors"];
}) {
  return (
    <>
      <SelectField
        label="Тип интервью"
        name="type"
        defaultValue={defaults.type}
        options={TYPE_OPTIONS}
        error={errors?.type}
      />

      {/* Ширину считаем от самого блока, а не от окна: блок стоит
          в узкой правой колонке, и три поля в ряд там не помещались —
          поле даты обрезалось вместе с кнопкой календаря. */}
      <div className="grid gap-3 @md:grid-cols-2 @xl:grid-cols-3">
        <TextField
          label="Дата"
          name="date"
          type="date"
          required
          defaultValue={defaults.date}
          error={errors?.date}
        />
        <TextField
          label="Время"
          name="time"
          type="time"
          required
          defaultValue={defaults.time}
          error={errors?.time}
        />
        <SelectField
          label="Длительность"
          name="durationMinutes"
          defaultValue={defaults.durationMinutes}
          options={DURATION_OPTIONS}
        />
      </div>

      <SelectField
        label="Интервьюер"
        name="interviewerId"
        defaultValue={defaults.interviewerId}
        options={[
          { value: "", label: "Не назначен" },
          ...users.map((user) => ({ value: user.id, label: user.fullName })),
        ]}
      />

      <TextareaField
        label="Комментарий"
        name="comment"
        rows={2}
        defaultValue={defaults.comment}
        placeholder="Ссылка на встречу, адрес офиса, о чём спросить"
        error={errors?.comment}
      />

      <MeetingLinkButton link={meetingLink} target="comment" />
    </>
  );
}

export function InterviewsBlock({
  candidateId,
  interviews,
  users,
  canManage,
  defaultDate,
  defaultInterviewerId,
  meetingLink,
}: {
  candidateId: string;
  interviews: InterviewView[];
  users: Person[];
  canManage: boolean;
  defaultDate: string;
  defaultInterviewerId: string;
  meetingLink: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [state, formAction] = useActionState(
    createInterview.bind(null, candidateId),
    {} as InterviewFormState,
  );

  // После удачного сохранения форму закрываем прямо здесь, а не эффектом:
  // список выше уже перерисовался новыми данными, и открытая форма
  // показывала бы введённое так, будто оно ещё не сохранено.
  const [editState, editAction] = useActionState(
    async (previous: InterviewFormState, formData: FormData) => {
      const result = await rescheduleInterview(previous, formData);
      if (result.success) setEditingId(null);
      return result;
    },
    {} as InterviewFormState,
  );

  return (
    <section className="rounded-xl border border-muted bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-ink">Интервью</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg border border-muted px-3 py-1.5 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
          >
            <CalendarPlus className="h-4 w-4" strokeWidth={1.8} />
            {open ? "Свернуть" : "Назначить интервью"}
          </button>
        )}
      </div>

      {state.success && !open && (
        <p className="mt-2 text-xs text-ink-soft">{state.success}</p>
      )}

      {open && canManage && (
        <form
          action={formAction}
          className="@container mt-4 space-y-3 rounded-lg border border-muted bg-canvas p-4"
        >
          {state.formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {state.formError}
            </div>
          )}

          <InterviewFields
            defaults={{
              type: "HR",
              date: defaultDate,
              time: "10:00",
              durationMinutes: "60",
              interviewerId: defaultInterviewerId,
              comment: "",
            }}
            users={users}
            meetingLink={meetingLink}
            errors={state.fieldErrors}
          />

          <div className="sm:w-48">
            <SubmitButton pendingLabel="Назначаем…">Назначить</SubmitButton>
          </div>
        </form>
      )}

      {interviews.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          Интервью пока не назначены.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {interviews.map((interview) => (
            <li
              key={interview.id}
              className="rounded-lg border border-muted bg-canvas p-3"
            >
              {editingId === interview.id ? (
                <form action={editAction} className="@container space-y-3">
                  <input
                    type="hidden"
                    name="interviewId"
                    value={interview.id}
                  />

                  {editState.formError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                      {editState.formError}
                    </div>
                  )}

                  <InterviewFields
                    defaults={{
                      type: interview.type,
                      date: interview.date,
                      time: interview.time,
                      durationMinutes: interview.durationMinutes,
                      interviewerId: interview.interviewerId,
                      comment: interview.comment ?? "",
                    }}
                    users={users}
                    meetingLink={meetingLink}
                    errors={editState.fieldErrors}
                  />

                  <div className="flex flex-wrap gap-2">
                    <div className="w-40">
                      <SubmitButton pendingLabel="Сохраняем…">
                        Сохранить
                      </SubmitButton>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-muted px-3 py-2 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">
                      {interview.typeLabel}
                    </p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs ${STATUS_STYLES[interview.status]}`}
                    >
                      {interview.statusLabel}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-ink">
                    {interview.whenText}
                    {interview.durationText
                      ? ` · ${interview.durationText}`
                      : ""}
                  </p>

                  <p className="text-xs text-ink-soft">
                    Интервьюер: {interview.interviewerName ?? "не назначен"}
                  </p>

                  {interview.comment && (
                    <p className="mt-1 text-sm whitespace-pre-wrap text-ink-soft">
                      <Linkify text={interview.comment} />
                    </p>
                  )}

                  {canManage && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {/* Изменить можно и отменённое, и проведённое:
                          в комментарий к прошедшей встрече дописывают
                          итоги, а отменённую иногда возвращают. */}
                      <button
                        type="button"
                        onClick={() => setEditingId(interview.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-muted bg-surface px-3 py-1.5 text-xs text-ink transition hover:border-ink-soft"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Изменить
                      </button>

                      {interview.status === "SCHEDULED" && (
                        <>
                          <form action={setInterviewStatus}>
                            <input
                              type="hidden"
                              name="interviewId"
                              value={interview.id}
                            />
                            <input
                              type="hidden"
                              name="status"
                              value="COMPLETED"
                            />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-muted bg-surface px-3 py-1.5 text-xs text-ink transition hover:border-ink-soft"
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={2} />
                              Проведено
                            </button>
                          </form>

                          <form action={setInterviewStatus}>
                            <input
                              type="hidden"
                              name="interviewId"
                              value={interview.id}
                            />
                            <input
                              type="hidden"
                              name="status"
                              value="CANCELED"
                            />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-muted bg-surface px-3 py-1.5 text-xs text-ink-soft transition hover:border-ink-soft hover:text-ink"
                            >
                              <X className="h-3.5 w-3.5" strokeWidth={2} />
                              Отменить
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
