"use client";

import { useActionState, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { createFeedback, type FeedbackFormState } from "@/app/actions/feedback";
import { Avatar } from "@/components/avatar";
import { SelectField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";

// Фидбэки по кандидату. Оставить может любая роль, включая
// нанимающего менеджера — для него это основная работа в системе.

export type FeedbackView = {
  id: string;
  authorName: string;
  // Должность коллеги: читающему важно, чьё это мнение —
  // рекрутера или руководителя, к которому человек пойдёт работать.
  authorPosition: string | null;
  whenText: string;
  stageName: string | null;
  result: "POSITIVE" | "NEGATIVE" | "EXTRA_STAGE";
  resultLabel: string;
  comment: string | null;
};

// Рамка и фон окошка — по результату, чтобы настроение фидбэка
// считывалось до чтения текста.
const CARD_STYLES: Record<string, string> = {
  POSITIVE: "border-green-200 bg-green-50/50",
  NEGATIVE: "border-red-200 bg-red-50/50",
  EXTRA_STAGE: "border-accent/40 bg-accent/10",
};

const RESULT_STYLES: Record<string, string> = {
  POSITIVE: "bg-green-100 text-green-800",
  NEGATIVE: "bg-red-50 text-red-700",
  EXTRA_STAGE: "bg-accent/25 text-ink",
};

export function FeedbackBlock({
  candidateId,
  feedbacks,
  stages,
  interviews,
  currentStageId,
  canCreate,
}: {
  candidateId: string;
  feedbacks: FeedbackView[];
  stages: { id: string; name: string }[];
  interviews: { id: string; label: string }[];
  currentStageId: string;
  canCreate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    createFeedback.bind(null, candidateId),
    {} as FeedbackFormState,
  );

  return (
    <section className="rounded-xl border border-muted bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-ink">Фидбэк</h2>
        {canCreate && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg border border-muted px-3 py-1.5 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
          >
            <MessageSquarePlus className="h-4 w-4" strokeWidth={1.8} />
            {open ? "Свернуть" : "Добавить фидбэк"}
          </button>
        )}
      </div>

      {state.success && !open && (
        <p className="mt-2 text-xs text-ink-soft">{state.success}</p>
      )}

      {open && canCreate && (
        <form
          action={formAction}
          className="mt-4 space-y-3 rounded-lg border border-muted bg-canvas p-4"
        >
          {state.formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {state.formError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Этап"
              name="stageId"
              defaultValue={currentStageId}
              options={stages.map((stage) => ({
                value: stage.id,
                label: stage.name,
              }))}
            />
            <SelectField
              label="Результат"
              name="result"
              defaultValue="POSITIVE"
              options={[
                { value: "POSITIVE", label: "Положительный" },
                { value: "NEGATIVE", label: "Отрицательный" },
                { value: "EXTRA_STAGE", label: "Нужен дополнительный этап" },
              ]}
              error={state.fieldErrors?.result}
            />
          </div>

          {interviews.length > 0 && (
            <SelectField
              label="Интервью"
              name="interviewId"
              defaultValue=""
              options={[
                { value: "", label: "Не привязывать" },
                ...interviews.map((interview) => ({
                  value: interview.id,
                  label: interview.label,
                })),
              ]}
              hint="Если фидбэк по конкретной встрече"
            />
          )}

          <TextareaField
            label="Комментарий"
            name="comment"
            rows={4}
            placeholder="Что понравилось, что насторожило, рекомендация"
            error={state.fieldErrors?.comment}
          />

          <div className="sm:w-48">
            <SubmitButton pendingLabel="Сохраняем…">Сохранить</SubmitButton>
          </div>
        </form>
      )}

      {feedbacks.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          Фидбэков пока нет. Здесь появятся мнения коллег о кандидате.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {feedbacks.map((feedback) => (
            <li
              key={feedback.id}
              className={`rounded-xl border p-3 ${CARD_STYLES[feedback.result]}`}
            >
              {/* Имя и должность занимают строку целиком: в узкой колонке
                  бейдж результата отжимал должность до многоточия,
                  а именно она объясняет, чьё это мнение. */}
              <div className="flex items-center gap-2.5">
                <Avatar name={feedback.authorName} size="sm" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {feedback.authorName}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {feedback.authorPosition ?? "должность не указана"}
                  </p>
                </div>
              </div>

              {feedback.comment && (
                <p className="mt-2.5 whitespace-pre-wrap text-sm text-ink">
                  {feedback.comment}
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs ${RESULT_STYLES[feedback.result]}`}
                >
                  {feedback.resultLabel}
                </span>
                <span className="text-xs text-ink-soft">
                  {feedback.whenText}
                  {feedback.stageName ? ` · ${feedback.stageName}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
