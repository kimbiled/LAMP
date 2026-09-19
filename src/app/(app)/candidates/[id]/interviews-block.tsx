"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Check, X } from "lucide-react";
import {
  createInterview,
  setInterviewStatus,
  type InterviewFormState,
} from "@/app/actions/interviews";
import { TextField } from "@/components/ui/text-field";
import { SelectField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";

// Интервью кандидата: список и форма назначения.
// Даты приходят уже отформатированными с сервера — так не бывает
// расхождений часовых поясов между сервером и браузером.

export type InterviewView = {
  id: string;
  typeLabel: string;
  statusLabel: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELED";
  whenText: string;
  durationText: string | null;
  interviewerName: string | null;
  comment: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-accent/25 text-ink",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELED: "bg-muted text-ink-soft",
};

export function InterviewsBlock({
  candidateId,
  interviews,
  users,
  canManage,
  defaultDate,
  defaultInterviewerId,
}: {
  candidateId: string;
  interviews: InterviewView[];
  users: { id: string; fullName: string }[];
  canManage: boolean;
  defaultDate: string;
  defaultInterviewerId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    createInterview.bind(null, candidateId),
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
          className="mt-4 space-y-3 rounded-lg border border-muted bg-canvas p-4"
        >
          {state.formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {state.formError}
            </div>
          )}

          <SelectField
            label="Тип интервью"
            name="type"
            defaultValue="HR"
            options={[
              { value: "HR", label: "HR-интервью" },
              { value: "TECHNICAL", label: "Техническое интервью" },
              { value: "MANAGER", label: "Интервью с руководителем" },
              { value: "FINAL", label: "Финальное интервью" },
              { value: "OTHER", label: "Другое" },
            ]}
            error={state.fieldErrors?.type}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              label="Дата"
              name="date"
              type="date"
              required
              defaultValue={defaultDate}
              error={state.fieldErrors?.date}
            />
            <TextField
              label="Время"
              name="time"
              type="time"
              required
              defaultValue="10:00"
              error={state.fieldErrors?.time}
            />
            <SelectField
              label="Длительность"
              name="durationMinutes"
              defaultValue="60"
              options={[
                { value: "30", label: "30 минут" },
                { value: "45", label: "45 минут" },
                { value: "60", label: "1 час" },
                { value: "90", label: "1,5 часа" },
                { value: "120", label: "2 часа" },
              ]}
            />
          </div>

          <SelectField
            label="Интервьюер"
            name="interviewerId"
            defaultValue={defaultInterviewerId}
            options={[
              { value: "", label: "Не назначен" },
              ...users.map((user) => ({
                value: user.id,
                label: user.fullName,
              })),
            ]}
          />

          <TextareaField
            label="Комментарий"
            name="comment"
            rows={2}
            placeholder="Ссылка на встречу, адрес офиса, о чём спросить"
            error={state.fieldErrors?.comment}
          />

          <div className="sm:w-48">
            <SubmitButton pendingLabel="Назначаем…">Назначить</SubmitButton>
          </div>
        </form>
      )}

      {interviews.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Интервью пока не назначены.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {interviews.map((interview) => (
            <li
              key={interview.id}
              className="rounded-lg border border-muted bg-canvas p-3"
            >
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
                {interview.durationText ? ` · ${interview.durationText}` : ""}
              </p>

              <p className="text-xs text-ink-soft">
                Интервьюер: {interview.interviewerName ?? "не назначен"}
              </p>

              {interview.comment && (
                <p className="mt-1 text-sm text-ink-soft">{interview.comment}</p>
              )}

              {canManage && interview.status === "SCHEDULED" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={setInterviewStatus}>
                    <input
                      type="hidden"
                      name="interviewId"
                      value={interview.id}
                    />
                    <input type="hidden" name="status" value="COMPLETED" />
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
                    <input type="hidden" name="status" value="CANCELED" />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-muted bg-surface px-3 py-1.5 text-xs text-ink-soft transition hover:border-ink-soft hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                      Отменить
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
