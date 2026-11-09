"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addTag, removeTag } from "@/app/actions/tags";

// Метки кандидата. Добавляются по Enter, снимаются крестиком.
// Список уже существующих меток компании подсказывается в поле ввода,
// чтобы не плодить «релокант» и «Релоканты» рядом.

export type TagView = { id: string; name: string };

export function TagsBlock({
  candidateId,
  tags,
  allTags,
  canEdit,
}: {
  candidateId: string;
  tags: TagView[];
  allTags: string[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const own = new Set(tags.map((tag) => tag.name));
  const suggestions = allTags.filter((name) => !own.has(name));

  function submit() {
    const name = value.trim();
    if (!name) {
      setAdding(false);
      return;
    }

    const formData = new FormData();
    formData.set("candidateId", candidateId);
    formData.set("name", name);

    setValue("");
    startTransition(() => addTag(formData));
    inputRef.current?.focus();
  }

  function drop(tagId: string) {
    const formData = new FormData();
    formData.set("candidateId", candidateId);
    formData.set("tagId", tagId);
    startTransition(() => removeTag(formData));
  }

  if (tags.length === 0 && !canEdit) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-0.5 rounded-md bg-muted py-0.5 pl-2.5 pr-0.5 text-xs text-ink"
        >
          {tag.name}
          {canEdit && (
            <button
              type="button"
              onClick={() => drop(tag.id)}
              disabled={pending}
              aria-label={`Снять метку ${tag.name}`}
              title={`Снять метку ${tag.name}`}
              className="flex size-7 items-center justify-center rounded text-ink-soft transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
            </button>
          )}
        </span>
      ))}

      {canEdit &&
        (adding ? (
          <>
            <input
              ref={inputRef}
              autoFocus
              value={value}
              list="tag-suggestions"
              maxLength={40}
              placeholder="английский B2"
              aria-label="Новая метка"
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
                if (event.key === "Escape") {
                  setValue("");
                  setAdding(false);
                }
              }}
              onBlur={submit}
              className="min-h-8 w-44 rounded-md border border-line-strong bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-ink focus:ring-[3px] focus:ring-accent/40"
            />
            <datalist id="tag-suggestions">
              {suggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-dashed border-line-strong px-2.5 text-xs text-ink-soft transition hover:border-ink hover:text-ink"
          >
            <Plus className="h-3 w-3" strokeWidth={2.4} />
            Метка
          </button>
        ))}
    </div>
  );
}
