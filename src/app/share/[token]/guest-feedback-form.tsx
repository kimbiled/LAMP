"use client";

import { useActionState } from "react";
import {
  submitGuestFeedback,
  type GuestFeedbackState,
} from "@/app/actions/share";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/fields";
import { ALERT_CLASSES } from "@/components/ui/styles";
import { SubmitButton } from "@/components/ui/submit-button";

// Форма отзыва для гостя, открывшего карточку по ссылке.
// Вход в систему не требуется, но имя указать нужно —
// иначе в истории будет непонятно, кто оставил мнение.

const GUEST_RESULTS = [
  { value: "POSITIVE", label: "Берём дальше" },
  { value: "EXTRA_STAGE", label: "Нужен ещё этап" },
  { value: "NEGATIVE", label: "Не подходит" },
];

export function GuestFeedbackForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    submitGuestFeedback.bind(null, token),
    {} as GuestFeedbackState,
  );

  if (state.success) {
    return (
      <div role="status" className={ALERT_CLASSES.success}>
        {state.success}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.formError && (
        <div role="alert" className={ALERT_CLASSES.danger}>
          {state.formError}
        </div>
      )}

      <TextField
        label="Ваше имя"
        name="authorName"
        required
        placeholder="Иван Петров"
        defaultValue={state.values?.authorName}
        error={state.fieldErrors?.authorName}
      />

      {/* Те же три оценки, что у сотрудников внутри системы, и без
          заранее выбранной: раньше по умолчанию стоял «Положительный». */}
      <fieldset>
        <legend className="text-sm font-medium text-ink">Ваша оценка</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {GUEST_RESULTS.map((item) => (
            <label
              key={item.value}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink has-[:checked]:border-ink has-[:checked]:bg-warning-soft has-[:checked]:font-medium"
            >
              <input
                type="radio"
                name="result"
                value={item.value}
                required
                defaultChecked={state.values?.result === item.value}
                className="size-4 accent-ink"
              />
              {item.label}
            </label>
          ))}
        </div>
        {state.fieldErrors?.result && (
          <p role="alert" className="mt-1.5 text-sm text-danger">
            {state.fieldErrors.result}
          </p>
        )}
      </fieldset>

      <TextareaField
        label="Комментарий"
        name="comment"
        rows={4}
        placeholder="Что думаете о кандидате"
        defaultValue={state.values?.comment}
        error={state.fieldErrors?.comment}
      />

      <div className="sm:w-52">
        <SubmitButton pendingLabel="Отправляем…">
          Отправить отзыв
        </SubmitButton>
      </div>
    </form>
  );
}
