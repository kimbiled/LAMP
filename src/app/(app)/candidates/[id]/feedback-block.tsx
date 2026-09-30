"use client";

import { useActionState, useState } from "react";
import { CircleDashed, Pencil, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import {
  createFeedback,
  deleteFeedback,
  updateFeedback,
  type FeedbackFormState,
} from "@/app/actions/feedback";
import { Avatar } from "@/components/avatar";
import { TextareaField } from "@/components/ui/fields";
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

// Тон мнения. Кнопками, а не выпадающим списком: выбор из трёх
// вариантов в списке — это два лишних нажатия на каждый фидбэк.
const TONES: {
  value: FeedbackView["result"];
  label: string;
  icon: typeof ThumbsUp;
  active: string;
}[] = [
  {
    value: "POSITIVE",
    label: "Берём дальше",
    icon: ThumbsUp,
    active: "border-green-400 bg-green-100 text-green-900",
  },
  {
    value: "EXTRA_STAGE",
    label: "Нужен ещё этап",
    icon: CircleDashed,
    active: "border-accent bg-accent/25 text-ink",
  },
  {
    value: "NEGATIVE",
    label: "Не подходит",
    icon: ThumbsDown,
    active: "border-red-400 bg-red-100 text-red-900",
  },
];

export function FeedbackBlock({
  candidateId,
  feedbacks,
  currentStageId,
  canCreate,
  canManage,
}: {
  candidateId: string;
  feedbacks: FeedbackView[];
  currentStageId: string;
  canCreate: boolean;
  // Править и удалять чужие мнения может только администратор.
  canManage: boolean;
}) {
  const [tone, setTone] = useState<FeedbackView["result"]>("POSITIVE");
  const [editing, setEditing] = useState<string | null>(null);

  const [state, formAction] = useActionState(
    createFeedback.bind(null, candidateId),
    {} as FeedbackFormState,
  );

  return (
    <section className="rounded-xl border border-muted bg-surface p-5">
      <h2 className="text-sm font-medium text-ink">Фидбэк</h2>

      {/* Поле открыто всегда. Раньше его прятала кнопка «Добавить
          фидбэк», и чтобы написать две строки, нужно было сначала
          развернуть форму, потом выбрать этап, результат и встречу.
          Этап подставляется текущий, привязка к встрече убрана —
          она нигде не показывалась и только отнимала время. */}
      {canCreate && (
        <form action={formAction} className="mt-3 space-y-2">
          {state.formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {state.formError}
            </div>
          )}

          <input type="hidden" name="stageId" value={currentStageId} />
          <input type="hidden" name="result" value={tone} />

          <TextareaField
            label="Ваше мнение о кандидате"
            name="comment"
            rows={3}
            placeholder="Что понравилось, что насторожило, рекомендация"
            error={state.fieldErrors?.comment}
          />

          <div className="flex flex-wrap items-center gap-2">
            {TONES.map((item) => {
              const Icon = item.icon;
              const chosen = tone === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTone(item.value)}
                  aria-pressed={chosen}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
                    chosen
                      ? item.active
                      : "border-muted text-ink-soft hover:border-ink-soft hover:text-ink"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {item.label}
                </button>
              );
            })}

            <div className="ml-auto w-36">
              <SubmitButton pendingLabel="Сохраняем…">Отправить</SubmitButton>
            </div>
          </div>

          {state.success && (
            <p className="text-xs text-ink-soft">{state.success}</p>
          )}
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

              {editing === feedback.id ? (
                <EditForm
                  feedback={feedback}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <>
                  {feedback.comment && (
                    <p className="mt-2.5 text-sm whitespace-pre-wrap text-ink">
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

                    {canManage && (
                      <span className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(feedback.id)}
                          className="rounded-md p-1 text-ink-soft transition hover:bg-surface hover:text-ink"
                          title="Изменить фидбэк"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </button>

                        <DeleteButton feedbackId={feedback.id} />
                      </span>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Правка фидбэка. Меняются только тон и текст: этап и встреча остаются
// прежними — фидбэк описывает конкретный момент, и переносить его
// задним числом было бы подделкой истории.
function EditForm({
  feedback,
  onDone,
}: {
  feedback: FeedbackView;
  onDone: () => void;
}) {
  const [tone, setTone] = useState<FeedbackView["result"]>(feedback.result);

  const [state, formAction] = useActionState(
    async (previous: FeedbackFormState, formData: FormData) => {
      const result = await updateFeedback(previous, formData);
      if (result.success) onDone();
      return result;
    },
    {} as FeedbackFormState,
  );

  return (
    <form action={formAction} className="mt-2.5 space-y-2">
      {state.formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.formError}
        </div>
      )}

      <input type="hidden" name="feedbackId" value={feedback.id} />
      <input type="hidden" name="result" value={tone} />

      <TextareaField
        label="Текст фидбэка"
        name="comment"
        rows={3}
        defaultValue={feedback.comment ?? ""}
        error={state.fieldErrors?.comment}
      />

      <div className="flex flex-wrap items-center gap-2">
        {TONES.map((item) => {
          const Icon = item.icon;
          const chosen = tone === item.value;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setTone(item.value)}
              aria-pressed={chosen}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                chosen
                  ? item.active
                  : "border-muted text-ink-soft hover:border-ink-soft hover:text-ink"
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              {item.label}
            </button>
          );
        })}

        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-muted px-3 py-1.5 text-xs text-ink-soft transition hover:border-ink-soft hover:text-ink"
          >
            Отмена
          </button>
          <div className="w-28">
            <SubmitButton pendingLabel="Сохраняем…">Сохранить</SubmitButton>
          </div>
        </span>
      </div>
    </form>
  );
}

// Удаление с подтверждением: чужое мнение стирается безвозвратно,
// в базе его не останется. Текст сохраняется в журнале действий.
function DeleteButton({ feedbackId }: { feedbackId: string }) {
  const [state, formAction] = useActionState(
    deleteFeedback,
    {} as FeedbackFormState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm("Удалить этот фидбэк? Вернуть его будет нельзя.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="feedbackId" value={feedbackId} />
      <button
        type="submit"
        title={state.formError ?? "Удалить фидбэк"}
        className="rounded-md p-1 text-ink-soft transition hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
      </button>
    </form>
  );
}
