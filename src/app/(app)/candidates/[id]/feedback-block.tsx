"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  CircleDashed,
  Pencil,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import {
  createFeedback,
  deleteFeedback,
  updateFeedback,
  type FeedbackFormState,
} from "@/app/actions/feedback";
import { Avatar } from "@/components/avatar";
import { TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { useConfirm } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ALERT_CLASSES, buttonClass } from "@/components/ui/styles";

// Отзывы по кандидату. Оставить может любая роль, включая
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

// Карточка отзыва белая, а настроение показывает цветная полоса слева
// и бейдж. Раньше вся карточка заливалась цветом: три «не подходит»
// подряд превращали колонку в сплошное розовое пятно, которое
// выглядело как ошибка системы.
const CARD_STYLES: Record<string, string> = {
  POSITIVE: "border-l-khaki-strong",
  NEGATIVE: "border-l-danger",
  EXTRA_STAGE: "border-l-accent-ink",
};

const RESULT_STYLES: Record<string, string> = {
  POSITIVE: "bg-success-soft text-success-ink",
  NEGATIVE: "bg-danger-soft text-danger-ink",
  EXTRA_STAGE: "bg-warning-soft text-ink",
};

// Кнопка выбора тона: крупная, чтобы попасть с первого раза.
const TONE_BUTTON =
  "inline-flex h-10 w-full items-center gap-2 rounded-lg border px-3 text-sm transition";
const TONE_IDLE =
  "border-line-strong bg-surface text-ink hover:bg-canvas";

// Тон мнения. Кнопками, а не выпадающим списком: выбор из трёх
// вариантов в списке — это два лишних нажатия на каждый отзыв.
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
    active: "border-khaki-strong bg-success-soft font-medium text-success-ink",
  },
  {
    value: "EXTRA_STAGE",
    label: "Нужен ещё этап",
    icon: CircleDashed,
    active: "border-accent-ink bg-warning-soft font-medium text-ink",
  },
  {
    value: "NEGATIVE",
    label: "Не подходит",
    icon: ThumbsDown,
    active: "border-danger bg-danger-soft font-medium text-danger-ink",
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
  // Оценка не выбрана заранее. Раньше по умолчанию стояло «Берём дальше»:
  // человек писал «не подходит», забывал переключить — и в аналитику
  // уходило положительное мнение.
  const [tone, setTone] = useState<FeedbackView["result"] | null>(null);
  const [toneMissing, setToneMissing] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const toast = useToast();

  const [state, formAction] = useActionState(
    async (previous: FeedbackFormState, formData: FormData) => {
      const result = await createFeedback(candidateId, previous, formData);
      // Отзыв принят — сообщаем и готовим форму к следующему.
      if (result.success) {
        toast.success(result.success);
        setTone(null);
      }
      return result;
    },
    {} as FeedbackFormState,
  );

  return (
    <section className="rounded-xl border border-line bg-warm p-5 shadow-sm">
      <h2 className="text-base font-semibold text-ink-strong">Отзывы</h2>

      {/* Поле открыто всегда. Раньше его прятала кнопка «Добавить
          отзыв», и чтобы написать две строки, нужно было сначала
          развернуть форму, потом выбрать этап, результат и встречу.
          Этап подставляется текущий, привязка к встрече убрана —
          она нигде не показывалась и только отнимала время. */}
      {canCreate && (
        <form
          action={formAction}
          onSubmit={(event) => {
            if (!tone) {
              event.preventDefault();
              setToneMissing(true);
            }
          }}
          className="mt-3 space-y-3"
        >
          {state.formError && (
            <div role="alert" className={ALERT_CLASSES.danger}>
              {state.formError}
            </div>
          )}

          <input type="hidden" name="stageId" value={currentStageId} />
          <input type="hidden" name="result" value={tone ?? ""} />

          <TextareaField
            label="Ваше мнение о кандидате"
            name="comment"
            rows={3}
            placeholder="Что понравилось, что насторожило, рекомендация"
            defaultValue={state.success ? "" : state.values?.comment}
            error={state.fieldErrors?.comment}
          />

          <fieldset>
            <legend className="text-sm font-medium text-ink">Ваша оценка</legend>
            {/* Три кнопки одной ширины друг под другом: в узкой колонке
                они всё равно не встают в ряд, а разной длины
                «лесенкой» смотрелись неаккуратно. */}
            <div className="mt-1.5 grid gap-2">
              {TONES.map((item) => {
                const Icon = item.icon;
                const chosen = tone === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setTone(item.value);
                      setToneMissing(false);
                    }}
                    aria-pressed={chosen}
                    className={`${TONE_BUTTON} ${chosen ? item.active : TONE_IDLE}`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    {item.label}
                  </button>
                );
              })}
            </div>
            {(toneMissing || state.fieldErrors?.result) && (
              <p role="alert" className="mt-1.5 text-sm text-danger">
                Выберите оценку: берём дальше, нужен ещё этап или не подходит
              </p>
            )}
          </fieldset>

          <SubmitButton pendingLabel="Отправляем…">Отправить отзыв</SubmitButton>
        </form>
      )}

      {feedbacks.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          Отзывов пока нет. Здесь появятся мнения коллег о кандидате.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {feedbacks.map((feedback) => (
            <li
              key={feedback.id}
              className={`rounded-xl border border-l-4 border-line bg-surface p-3 ${CARD_STYLES[feedback.result]}`}
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
                <EditForm feedback={feedback} onDone={() => setEditing(null)} />
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
                      <span className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(feedback.id)}
                          aria-label="Изменить отзыв"
                          title="Изменить отзыв"
                          className={buttonClass({ variant: "ghost", size: "icon-sm" })}
                        >
                          <Pencil className="h-4 w-4" strokeWidth={1.8} aria-hidden />
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

// Правка отзыва. Меняются только тон и текст: этап и встреча остаются
// прежними — отзыв описывает конкретный момент, и переносить его
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
        <div role="alert" className={ALERT_CLASSES.danger}>
          {state.formError}
        </div>
      )}

      <input type="hidden" name="feedbackId" value={feedback.id} />
      <input type="hidden" name="result" value={tone} />

      <TextareaField
        label="Текст отзыва"
        name="comment"
        rows={3}
        defaultValue={state.values?.comment ?? feedback.comment ?? ""}
        error={state.fieldErrors?.comment}
      />

      <div className="grid gap-2">
        {TONES.map((item) => {
          const Icon = item.icon;
          const chosen = tone === item.value;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setTone(item.value)}
              aria-pressed={chosen}
              className={`${TONE_BUTTON} ${chosen ? item.active : TONE_IDLE}`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              {item.label}
            </button>
          );
        })}

      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onDone}
          className={buttonClass({ variant: "secondary" })}
        >
          Отмена
        </button>
        <SubmitButton pendingLabel="Сохраняем…" full={false}>
          Сохранить
        </SubmitButton>
      </div>
    </form>
  );
}

// Удаление с подтверждением: чужое мнение стирается безвозвратно,
// в базе его не останется. Текст сохраняется в журнале действий.
function DeleteButton({ feedbackId }: { feedbackId: string }) {
  const confirm = useConfirm();
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [, formAction] = useActionState(
    async (previous: FeedbackFormState, formData: FormData) => {
      const result = await deleteFeedback(previous, formData);
      if (result.formError) toast.error(result.formError);
      if (result.success) toast.success(result.success);
      return result;
    },
    {} as FeedbackFormState,
  );

  async function ask() {
    const confirmed = await confirm({
      title: "Удалить этот отзыв?",
      message: "Вернуть его будет нельзя.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!confirmed || !form.current) return;
    const data = new FormData(form.current);
    startTransition(() => formAction(data));
  }

  return (
    <form ref={form} onSubmit={(event) => event.preventDefault()}>
      <input type="hidden" name="feedbackId" value={feedbackId} />
      <button
        type="button"
        onClick={ask}
        disabled={pending}
        aria-label="Удалить отзыв"
        title="Удалить отзыв"
        className={buttonClass({
          variant: "ghost",
          size: "icon-sm",
          className: "hover:bg-danger-soft hover:text-danger",
        })}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
      </button>
    </form>
  );
}
