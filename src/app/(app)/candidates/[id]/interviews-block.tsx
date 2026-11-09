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
import { ConfirmForm } from "@/components/ui/confirm-form";
import { buttonClass } from "@/components/ui/styles";
import { JoinMeetingLink, MeetingUrlField, OfficeBadge } from "@/components/meeting-url-field";
import type { InterviewFormatValue } from "@/lib/meeting";
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
  // Ссылка для кнопки «Подключиться»: из поля или, у старых встреч,
  // из комментария. meetingUrl — то, что лежит в поле формы.
  joinUrl: string | null;
  meetingUrl: string;
  // Онлайн или в офисе; null — старое интервью без ссылки.
  format: InterviewFormatValue | null;

  type: string;
  date: string;
  time: string;
  durationMinutes: string;
  interviewerId: string;
};

type Person = { id: string; fullName: string };

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-glow text-ink",
  COMPLETED: "bg-khaki-soft text-khaki-ink",
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
  invite,
  errors,
}: {
  defaults: {
    type: string;
    date: string;
    time: string;
    durationMinutes: string;
    interviewerId: string;
    comment: string;
    meetingUrl: string;
    format: InterviewFormatValue | null;
  };
  users: Person[];
  meetingLink: string | null;
  // Для кнопки «Скопировать приглашение»: кого и на какую вакансию зовём.
  invite: { candidateName: string; jobTitle: string | null };
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
        placeholder="О чём спросить, что взять с собой"
        error={errors?.comment}
      />

      <MeetingUrlField
        defaultValue={defaults.meetingUrl}
        defaultFormat={defaults.format}
        companyLink={meetingLink}
        candidateName={invite.candidateName}
        jobTitle={invite.jobTitle}
        error={errors?.meetingUrl}
      />
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
  candidateName,
  jobTitle,
}: {
  candidateId: string;
  candidateName: string;
  jobTitle: string | null;
  interviews: InterviewView[];
  users: Person[];
  canManage: boolean;
  defaultDate: string;
  defaultInterviewerId: string;
  meetingLink: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Обе формы закрываются сами после удачного сохранения — и делается
  // это прямо здесь, а не эффектом: список выше уже перерисовался
  // новыми данными, и открытая форма показывала бы введённое так,
  // будто оно ещё не сохранено.
  const [state, formAction] = useActionState(
    async (previous: InterviewFormState, formData: FormData) => {
      const result = await createInterview(candidateId, previous, formData);
      if (result.success) setOpen(false);
      return result;
    },
    {} as InterviewFormState,
  );

  const [editState, editAction] = useActionState(
    async (previous: InterviewFormState, formData: FormData) => {
      const result = await rescheduleInterview(previous, formData);
      if (result.success) setEditingId(null);
      return result;
    },
    {} as InterviewFormState,
  );

  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink-strong">Интервью</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink transition hover:bg-canvas"
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
          className="@container mt-4 space-y-3 rounded-lg border border-line bg-canvas p-4"
        >
          {state.formError && (
            <div className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger">
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
              meetingUrl: "",
              format: null,
            }}
            users={users}
            meetingLink={meetingLink}
            invite={{ candidateName, jobTitle }}
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
              className="rounded-lg border border-line bg-canvas p-3"
            >
              {editingId === interview.id ? (
                <form action={editAction} className="@container space-y-3">
                  <input
                    type="hidden"
                    name="interviewId"
                    value={interview.id}
                  />

                  {editState.formError && (
                    <div className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger">
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
                      meetingUrl: interview.meetingUrl,
                      format: interview.format,
                    }}
                    users={users}
                    meetingLink={meetingLink}
            invite={{ candidateName, jobTitle }}
                    errors={editState.fieldErrors}
                  />

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className={buttonClass({ variant: "secondary" })}
                    >
                      Отмена
                    </button>
                    <SubmitButton pendingLabel="Сохраняем…" full={false}>
                      Сохранить
                    </SubmitButton>
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

                  {interview.status === "SCHEDULED" && interview.format === "OFFICE" && (
                    <div className="mt-2">
                      <OfficeBadge />
                    </div>
                  )}

                  {interview.status === "SCHEDULED" && interview.joinUrl && (
                    <div className="mt-2">
                      <JoinMeetingLink url={interview.joinUrl} />
                    </div>
                  )}

                  {canManage && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {/* Изменить можно и отменённое, и проведённое:
                          в комментарий к прошедшей встрече дописывают
                          итоги, а отменённую иногда возвращают. */}
                      <button
                        type="button"
                        onClick={() => setEditingId(interview.id)}
                        className={buttonClass({ variant: "secondary", size: "sm" })}
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.8} aria-hidden />
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
                              className={buttonClass({ variant: "secondary", size: "sm" })}
                            >
                              <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
                              Проведено
                            </button>
                          </form>

                          <ConfirmForm
                            action={setInterviewStatus}
                            confirm={{
                              title: "Отменить встречу?",
                              message: `${interview.typeLabel}, ${interview.whenText}. Встреча останется в истории как отменённая.`,
                              confirmLabel: "Отменить встречу",
                              cancelLabel: "Не отменять",
                              danger: true,
                            }}
                          >
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
                              className={buttonClass({ variant: "danger-outline", size: "sm" })}
                            >
                              <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                              Отменить встречу
                            </button>
                          </ConfirmForm>
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
