"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import type { ResumeFormState } from "@/app/actions/resumes";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: ResumeFormState = {};

// Форма выбора файла резюме. Используется в двух местах:
// при добавлении нового кандидата и в карточке существующего.

export function ResumeUploadForm({
  action,
  submitLabel,
  pendingLabel = "Читаем файл…",
  jobId,
  compact,
}: {
  action: (
    state: ResumeFormState,
    formData: FormData,
  ) => Promise<ResumeFormState>;
  submitLabel: string;
  pendingLabel?: string;
  jobId?: string;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      {jobId && <input type="hidden" name="jobId" value={jobId} />}

      {state.formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {state.formError}
        </div>
      )}

      {state.success && (
        <div className="rounded-lg border border-muted bg-muted px-3 py-2.5 text-sm text-ink">
          {state.success}
        </div>
      )}

      <div
        className={compact ? "flex flex-col gap-3 sm:flex-row sm:items-center" : "space-y-3"}
      >
        <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-muted bg-canvas px-4 py-3 text-sm text-ink-soft transition hover:border-ink-soft">
          <Upload className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          <span className="min-w-0 flex-1">Выбрать файл PDF или DOCX</span>
          <input
            type="file"
            name="file"
            required
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="min-w-0 flex-1 text-xs text-ink file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:text-ink"
          />
        </label>

        <div className={compact ? "sm:w-52" : ""}>
          <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
        </div>
      </div>

      <p className="text-xs text-ink-soft">
        Максимальный размер файла — 10 МБ. Резюме-картинки и сканы система
        прочитать не сможет.
      </p>
    </form>
  );
}
