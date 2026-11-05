"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FileJson,
  Loader2,
  X,
} from "lucide-react";

// Разбор файла из расширения и загрузка кандидатов по одному.
//
// Файл читается прямо в браузере: сначала показываем, кого собрали,
// и только по нажатию «Импортировать» отправляем на сервер. Так видно,
// что именно попадёт в базу, и можно снять галочки с лишних.
//
// Отправляем по одному кандидату за запрос. Пачка в тридцать резюме —
// это мегабайты, и слать их одним куском значит рисковать всем ради
// одного сбоя. Заодно видно живой ход работы.

type Entry = {
  url: string;
  fileName: string;
  fileBase64: string;
  sizeBytes?: number;
  hints?: {
    fullName?: string | null;
    position?: string | null;
    city?: string | null;
  } | null;
};

type RowState =
  | { kind: "waiting" }
  | { kind: "running" }
  | {
      kind: "created";
      candidateId: string;
      fullName: string;
      score: number;
      duplicates: { id: string; fullName: string }[];
    }
  | { kind: "already"; candidateId: string; fullName: string }
  | { kind: "failed"; message: string };

export function ImportForm({
  jobs,
}: {
  jobs: { id: string; title: string }[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [states, setStates] = useState<Record<string, RowState>>({});
  const [jobId, setJobId] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setStates({});

    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      setFileError("Это не файл сборщика — содержимое не читается");
      return;
    }

    const list =
      payload && typeof payload === "object" && "candidates" in payload
        ? (payload as { candidates: unknown }).candidates
        : null;

    if (!Array.isArray(list) || list.length === 0) {
      setFileError("В файле нет ни одного резюме");
      return;
    }

    const valid = list.filter(
      (item): item is Entry =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as Entry).url === "string" &&
        typeof (item as Entry).fileBase64 === "string",
    );

    if (valid.length === 0) {
      setFileError("Записи в файле не похожи на резюме");
      return;
    }

    setEntries(valid);
    setChosen(new Set(valid.map((item) => item.url)));
  }

  function toggle(url: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function importAll() {
    setRunning(true);

    for (const entry of entries) {
      if (!chosen.has(entry.url)) continue;

      setStates((s) => ({ ...s, [entry.url]: { kind: "running" } }));

      try {
        const response = await fetch("/api/candidates/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: entry.url,
            fileName: entry.fileName,
            fileBase64: entry.fileBase64,
            hints: entry.hints ?? null,
            jobId: jobId || null,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setStates((s) => ({
            ...s,
            [entry.url]: {
              kind: "failed",
              message: result?.error ?? `Ошибка ${response.status}`,
            },
          }));
          continue;
        }

        setStates((s) => ({
          ...s,
          [entry.url]:
            result.status === "already"
              ? {
                  kind: "already",
                  candidateId: result.candidateId,
                  fullName: result.fullName,
                }
              : {
                  kind: "created",
                  candidateId: result.candidateId,
                  fullName: result.fullName,
                  score: result.score,
                  duplicates: result.duplicates ?? [],
                },
        }));
      } catch {
        setStates((s) => ({
          ...s,
          [entry.url]: {
            kind: "failed",
            message: "Сервер не ответил",
          },
        }));
      }
    }

    setRunning(false);
    router.refresh();
  }

  const done = Object.values(states).filter(
    (state) => state.kind !== "waiting" && state.kind !== "running",
  ).length;

  const createdCount = Object.values(states).filter(
    (state) => state.kind === "created",
  ).length;

  if (entries.length === 0) {
    return (
      <div className="mt-4">
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-surface p-10 text-center transition hover:border-ink-soft">
          <FileJson className="h-8 w-8 text-ink-soft" strokeWidth={1.5} />
          <span className="text-sm font-medium text-ink">
            Выберите файл, выгруженный расширением
          </span>
          <span className="text-xs text-ink-soft">
            Это файл вида lamp-резюме-2026-09-23.json
          </span>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="hidden"
          />
        </label>

        {fileError && (
          <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {fileError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div>
          <p className="text-sm font-medium text-ink">
            В файле {entries.length}, выбрано {chosen.size}
          </p>
          {running && (
            <p className="mt-0.5 text-xs text-ink-soft">
              Готово {done} из {chosen.size}. Не закрывайте страницу.
            </p>
          )}
          {!running && done > 0 && (
            <p className="mt-0.5 text-xs text-ink-soft">
              Заведено новых: {createdCount}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            disabled={running}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="">Без вакансии</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={importAll}
            disabled={running || chosen.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink transition hover:bg-accent-hover disabled:opacity-50"
          >
            {running && <Loader2 className="h-4 w-4 animate-spin" />}
            {running ? "Импортирую…" : "Импортировать"}
          </button>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {entries.map((entry) => {
          const state = states[entry.url] ?? { kind: "waiting" };
          const name = entry.hints?.fullName || entry.fileName;

          return (
            <li key={entry.url} className="flex items-start gap-3 p-3">
              <input
                type="checkbox"
                checked={chosen.has(entry.url)}
                onChange={() => toggle(entry.url)}
                disabled={running || state.kind !== "waiting"}
                className="mt-1 h-4 w-4 shrink-0 accent-[#ffd44d]"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-strong">
                  {name}
                </p>
                <p className="truncate text-xs text-ink-soft">
                  {entry.hints?.position || "должность не указана"}
                  {entry.hints?.city ? ` · ${entry.hints.city}` : ""}
                </p>

                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-soft underline decoration-muted underline-offset-2 hover:text-ink"
                >
                  <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
                  Открыть на hh
                </a>
              </div>

              <div className="shrink-0 text-right text-xs">
                <RowStatus state={state} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RowStatus({ state }: { state: RowState }) {
  if (state.kind === "waiting") {
    return <span className="text-ink-soft">—</span>;
  }

  if (state.kind === "running") {
    return <Loader2 className="ml-auto h-4 w-4 animate-spin text-ink-soft" />;
  }

  if (state.kind === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-danger">
        <X className="h-3.5 w-3.5" strokeWidth={2} />
        {state.message}
      </span>
    );
  }

  if (state.kind === "already") {
    return (
      <Link
        href={`/candidates/${state.candidateId}`}
        className="inline-flex items-center gap-1 text-ink-soft hover:text-ink"
      >
        уже есть
      </Link>
    );
  }

  return (
    <div className="space-y-0.5">
      <Link
        href={`/candidates/${state.candidateId}`}
        className="inline-flex items-center gap-1 font-medium text-khaki-ink hover:underline"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2} />
        заведён · {state.score}%
      </Link>

      {state.duplicates.length > 0 && (
        <p className="inline-flex items-center gap-1 text-accent-ink">
          <AlertTriangle className="h-3 w-3" strokeWidth={2} />
          похож на {state.duplicates[0].fullName}
        </p>
      )}
    </div>
  );
}
