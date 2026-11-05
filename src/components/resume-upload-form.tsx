"use client";

import { useActionState, useState } from "react";
import { FileText, Upload } from "lucide-react";
import type { ResumeFormState } from "@/app/actions/resumes";
import { SubmitButton } from "@/components/ui/submit-button";
import { ALERT_CLASSES } from "@/components/ui/styles";

const initialState: ResumeFormState = {};

// Форма выбора файла резюме. Используется в двух местах:
// при добавлении нового кандидата и в карточке существующего.

export function ResumeUploadForm({
  action,
  submitLabel,
  pendingLabel = "Читаем файл…",
  jobId,
}: {
  action: (
    state: ResumeFormState,
    formData: FormData,
  ) => Promise<ResumeFormState>;
  submitLabel: string;
  pendingLabel?: string;
  jobId?: string;
}) {
  // Имя выбранного файла показываем сами: системное поле выбора
  // браузер подписывает на языке своей установки («Choose File»,
  // «No file chosen»), и посреди русского интерфейса это путает.
  const [fileName, setFileName] = useState<string | null>(null);
  // После отправки React очищает форму, а с ней и выбранный файл —
  // убираем и подпись, чтобы она не показывала уже ушедший файл.
  const [state, formAction] = useActionState(
    async (prev: ResumeFormState, formData: FormData) => {
      const result = await action(prev, formData);
      setFileName(null);
      return result;
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      {jobId && <input type="hidden" name="jobId" value={jobId} />}

      {state.formError && (
        <div role="alert" className={ALERT_CLASSES.danger}>
          {state.formError}
        </div>
      )}

      {state.success && (
        <div role="status" className={ALERT_CLASSES.success}>
          {state.success}
        </div>
      )}

      <div className="space-y-3">
        {/* Само поле выбора файла спрятано (sr-only), но остаётся
            в форме: клавиатура до него доходит, а проверка «файл
            обязателен» по-прежнему работает. Видна только рамка. */}
        <label className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong bg-canvas px-4 py-4 transition hover:border-ink hover:bg-surface has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
          {fileName ? (
            <FileText className="h-5 w-5 shrink-0 text-ink" strokeWidth={1.8} aria-hidden />
          ) : (
            <Upload className="h-5 w-5 shrink-0 text-ink-soft" strokeWidth={1.8} aria-hidden />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">
              {fileName ?? "Выберите файл резюме"}
            </span>
            <span className="block text-xs text-ink-soft">
              {fileName ? "Нажмите, чтобы выбрать другой" : "PDF, DOCX, RTF, TXT или фото"}
            </span>
          </span>
          <input
            type="file"
            name="file"
            required
            accept=".pdf,.docx,.rtf,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf,text/plain,image/jpeg,image/png,image/webp"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
            className="sr-only"
          />
        </label>

        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>

      <p className="text-xs text-ink-soft">
        Максимальный размер файла — 10 МБ. Сканы и фотографии система распознаёт
        сама, но на это уходит несколько секунд, и проверить результат стоит
        внимательнее обычного.
      </p>
    </form>
  );
}
