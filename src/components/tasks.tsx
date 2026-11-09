"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Plus, Trash2, UserRound, X } from "lucide-react";
import { createTask, deleteTask, toggleTask } from "@/app/actions/tasks";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { NETWORK_ERROR, useToast } from "@/components/ui/toast";
import { searchVariants } from "@/lib/search-variants";

// Дела блокнота: строка дела, форма добавления и выбор кандидата.
// Используются на странице «Блокнот» и в карточке кандидата.

export type TaskView = {
  id: string;
  title: string;
  note: string | null;
  // «2026-11-12» или null — без даты.
  day: string | null;
  done: boolean;
  candidate: { id: string; fullName: string } | null;
};

export type CandidateChoice = { id: string; fullName: string; position: string | null };

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function shortDay(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${date} ${MONTHS_SHORT[month - 1]}`;
}

export function TaskItem({
  task,
  today,
  showCandidate = true,
}: {
  task: TaskView;
  today: string;
  showCandidate?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useState(task.done);
  const router = useRouter();
  const toast = useToast();

  const overdue = !optimisticDone && task.day !== null && task.day < today;

  function run(action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>) {
    const formData = new FormData();
    formData.set("taskId", task.id);
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (!result.ok) toast.error(result.error ?? "Не получилось");
        router.refresh();
      } catch {
        toast.error(NETWORK_ERROR);
      }
    });
  }

  return (
    <li
      className={`group flex items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-canvas ${
        pending ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={optimisticDone}
        aria-label={optimisticDone ? "Отметить как невыполненное" : "Отметить как выполненное"}
        onClick={() => {
          setOptimisticDone(!optimisticDone);
          run(toggleTask);
        }}
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition ${
          optimisticDone
            ? "border-khaki-strong bg-khaki-strong text-white"
            : "border-line-strong bg-surface hover:border-ink"
        }`}
      >
        {optimisticDone && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-sm ${optimisticDone ? "text-ink-soft line-through" : "text-ink"}`}>
          {task.title}
        </p>
        {task.note && (
          <p className="mt-0.5 text-xs whitespace-pre-line text-ink-soft">{task.note}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {task.day && (
            <span
              className={`inline-flex items-center gap-1 ${
                overdue ? "font-medium text-danger" : "text-ink-soft"
              }`}
            >
              <CalendarDays className="size-3.5" strokeWidth={1.8} aria-hidden />
              {overdue ? `просрочено · ${shortDay(task.day)}` : shortDay(task.day)}
            </span>
          )}
          {showCandidate && task.candidate && (
            <Link
              href={`/candidates/${task.candidate.id}`}
              className="inline-flex items-center gap-1 text-ink-soft underline-offset-2 hover:text-ink hover:underline"
            >
              <UserRound className="size-3.5" strokeWidth={1.8} aria-hidden />
              {task.candidate.fullName}
            </Link>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => run(deleteTask)}
        aria-label={`Удалить: ${task.title}`}
        className="rounded-md p-1 text-ink-faint transition hover:bg-muted hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <Trash2 className="size-4" strokeWidth={1.8} aria-hidden />
      </button>
    </li>
  );
}

// Выбор кандидата с поиском: список может быть на сотни человек,
// поэтому сначала печатаем часть имени — в любой раскладке.
export function CandidatePicker({
  candidates,
  value,
  onChange,
}: {
  candidates: CandidateChoice[];
  value: CandidateChoice | null;
  onChange: (next: CandidateChoice | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const found = useMemo(() => {
    const variants = searchVariants(query).map((item) => item.toLowerCase());
    const list = variants.length
      ? candidates.filter((candidate) => {
          const hay = `${candidate.fullName} ${candidate.position ?? ""}`.toLowerCase();
          return variants.some((variant) => hay.includes(variant));
        })
      : candidates;
    return list.slice(0, 8);
  }, [candidates, query]);

  if (value) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-canvas py-1 pr-1 pl-2.5 text-sm text-ink">
        <UserRound className="size-4 shrink-0 text-ink-soft" strokeWidth={1.8} aria-hidden />
        <span className="truncate">{value.fullName}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Убрать кандидата"
          className="rounded p-0.5 text-ink-soft hover:bg-muted hover:text-ink"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <div
      ref={boxRef}
      className="relative"
      onBlur={(event) => {
        if (!boxRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <input
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Кандидат — необязательно"
        aria-label="Кандидат"
        className={inputClass(false, "h-9 py-1.5")}
      />
      {open && (
        <ul className="absolute left-0 z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
          {found.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-soft">Никого не нашли</li>
          ) : (
            found.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(candidate);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-ink hover:bg-muted"
                >
                  {candidate.fullName}
                  {candidate.position && (
                    <span className="block text-xs text-ink-soft">{candidate.position}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function AddTaskForm({
  defaultDay,
  candidates,
  fixedCandidate,
  placeholder = "Что нужно сделать?",
}: {
  defaultDay: string | null;
  candidates: CandidateChoice[];
  // В карточке кандидата он уже выбран и не меняется.
  fixedCandidate?: CandidateChoice;
  placeholder?: string;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState(defaultDay ?? "");
  const [candidate, setCandidate] = useState<CandidateChoice | null>(fixedCandidate ?? null);
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  // День в форме следует за выбранным днём календаря.
  const [lastDefault, setLastDefault] = useState(defaultDay);
  if (defaultDay !== lastDefault) {
    setLastDefault(defaultDay);
    setDay(defaultDay ?? "");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const formData = new FormData();
    formData.set("title", title);
    formData.set("note", note);
    formData.set("day", day);
    formData.set("candidateId", candidate?.id ?? "");
    startTransition(async () => {
      try {
        const result = await createTask(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setTitle("");
        setNote("");
        if (!fixedCandidate) setCandidate(null);
        setExpanded(false);
        router.refresh();
      } catch {
        toast.error(NETWORK_ERROR);
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-surface p-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onFocus={() => setExpanded(true)}
          placeholder={placeholder}
          aria-label="Новое дело"
          maxLength={300}
          className={inputClass(false, "h-10")}
        />
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className={buttonClass({ variant: "primary", className: "shrink-0" })}
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          <span className="hidden sm:inline">Добавить</span>
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Заметка — необязательно"
            aria-label="Заметка"
            className={inputClass(false, "text-sm")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <CalendarDays className="size-4" strokeWidth={1.8} aria-hidden />
              <input
                type="date"
                value={day}
                onChange={(event) => setDay(event.target.value)}
                aria-label="День"
                className={inputClass(false, "h-9 w-auto py-1")}
              />
            </label>
            {day && (
              <button
                type="button"
                onClick={() => setDay("")}
                className="text-xs text-ink-soft underline hover:text-ink"
              >
                без даты
              </button>
            )}
            {!fixedCandidate && (
              <div className="min-w-56 flex-1">
                <CandidatePicker candidates={candidates} value={candidate} onChange={setCandidate} />
              </div>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
