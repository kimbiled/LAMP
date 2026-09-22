import { Download, ExternalLink, FileText, RefreshCw } from "lucide-react";
import { attachResume, reparseResume } from "@/app/actions/resumes";
import { ResumeUploadForm } from "@/components/resume-upload-form";
import { formatBytes, formatDateTime } from "@/lib/format";

type Resume = {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: Date;
  isCurrent: boolean;
  // Как достали текст и насколько полно разобрали файл.
  // Рекрутеру это подсказывает, где стоит перепроверить руками.
  textSource: string | null;
  parseScore: number | null;
  uploadedBy: { fullName: string };
};

const SOURCE_LABELS: Record<string, string> = {
  PDF_TEXT: "текст из PDF",
  PDF_OCR: "распознано со скана",
  DOCX: "документ Word",
  IMAGE_OCR: "распознано с фотографии",
  PLAIN: "обычный текст",
};

export function ResumeSection({
  candidateId,
  resumes,
  canUpload,
}: {
  candidateId: string;
  resumes: Resume[];
  canUpload: boolean;
}) {
  const current = resumes.find((resume) => resume.isCurrent) ?? resumes[0];
  const older = resumes.filter((resume) => resume.id !== current?.id);
  const action = attachResume.bind(null, candidateId);

  return (
    <section className="rounded-xl border border-muted bg-surface p-5">
      <h2 className="text-sm font-medium text-ink">Резюме</h2>

      {current ? (
        <div className="mt-3 rounded-lg border border-muted bg-canvas p-3">
          <div className="flex items-start gap-3">
            <FileText
              className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft"
              strokeWidth={1.8}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{current.fileName}</p>
              <p className="text-xs text-ink-soft">
                {formatBytes(current.sizeBytes)} ·{" "}
                {formatDateTime(current.uploadedAt)} ·{" "}
                {current.uploadedBy.fullName}
              </p>

              {current.textSource && (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <span
                    className={
                      current.textSource.includes("OCR")
                        ? "rounded bg-accent/25 px-1.5 py-0.5 text-ink"
                        : "rounded bg-muted px-1.5 py-0.5 text-ink-soft"
                    }
                  >
                    {SOURCE_LABELS[current.textSource] ?? current.textSource}
                  </span>
                  {current.parseScore !== null && (
                    <span className="text-ink-soft">
                      разобрано на {current.parseScore}%
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/api/resumes/${current.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-muted bg-surface px-3 py-1.5 text-sm text-ink transition hover:border-ink-soft"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
              Открыть
            </a>
            <a
              href={`/api/resumes/${current.id}?download`}
              className="inline-flex items-center gap-2 rounded-lg border border-muted bg-surface px-3 py-1.5 text-sm text-ink transition hover:border-ink-soft"
            >
              <Download className="h-4 w-4" strokeWidth={1.8} />
              Скачать
            </a>

            {canUpload && (
              <form action={reparseResume}>
                <input type="hidden" name="candidateId" value={candidateId} />
                <button
                  type="submit"
                  title="Перечитать файл и заполнить опыт работы и образование"
                  className="inline-flex items-center gap-2 rounded-lg border border-muted bg-surface px-3 py-1.5 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
                >
                  <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
                  Распознать заново
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">Резюме ещё не загружено.</p>
      )}

      {older.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-ink-soft">Предыдущие версии</p>
          <ul className="mt-1.5 space-y-1">
            {older.map((resume) => (
              <li key={resume.id}>
                <a
                  href={`/api/resumes/${resume.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-ink-soft underline transition hover:text-ink"
                >
                  {resume.fileName} · {formatDateTime(resume.uploadedAt)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canUpload && (
        <div className="mt-4 border-t border-muted pt-4">
          <ResumeUploadForm
            action={action}
            submitLabel={current ? "Заменить" : "Загрузить"}
            pendingLabel="Загружаем…"
            compact
          />
        </div>
      )}
    </section>
  );
}
