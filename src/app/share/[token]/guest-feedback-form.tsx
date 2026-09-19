"use client";

import { useActionState } from "react";
import {
  submitGuestFeedback,
  type GuestFeedbackState,
} from "@/app/actions/share";
import { TextField } from "@/components/ui/text-field";
import { SelectField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";

// Форма фидбэка для гостя, открывшего карточку по ссылке.
// Вход в систему не требуется, но имя указать нужно —
// иначе в истории будет непонятно, кто оставил мнение.

export function GuestFeedbackForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    submitGuestFeedback.bind(null, token),
    {} as GuestFeedbackState,
  );

  if (state.success) {
    return (
      <div className="rounded-lg border border-muted bg-muted p-4 text-sm text-ink">
        {state.success}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {state.formError}
        </div>
      )}

      <TextField
        label="Ваше имя"
        name="authorName"
        required
        placeholder="Иван Петров"
        error={state.fieldErrors?.authorName}
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

      <TextareaField
        label="Комментарий"
        name="comment"
        rows={4}
        placeholder="Что думаете о кандидате"
        error={state.fieldErrors?.comment}
      />

      <div className="sm:w-52">
        <SubmitButton pendingLabel="Отправляем…">
          Отправить фидбэк
        </SubmitButton>
      </div>
    </form>
  );
}
