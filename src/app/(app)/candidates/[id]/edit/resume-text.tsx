"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";

// Распознанный текст резюме рядом с формой проверки.
//
// Система разбирает текст правилами и что-то неизбежно пропускает.
// Раньше рекрутеру приходилось открывать сам файл, искать нужное глазами
// и перепечатывать. Теперь текст лежит рядом: можно выделить и скопировать.

export function ResumeText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-4 rounded-xl border border-muted bg-surface">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-ink-soft" strokeWidth={1.8} />
          <span className="text-sm font-medium text-ink">Текст резюме</span>
          <span className="text-xs text-ink-soft">
            то, что система прочитала из файла
          </span>
        </span>

        {open ? (
          <ChevronUp
            className="h-4 w-4 shrink-0 text-ink-soft"
            strokeWidth={1.8}
          />
        ) : (
          <ChevronDown
            className="h-4 w-4 shrink-0 text-ink-soft"
            strokeWidth={1.8}
          />
        )}
      </button>

      {open && (
        <div className="border-t border-muted px-5 py-4">
          <p className="mb-3 text-xs text-ink-soft">
            Если система что-то пропустила, найдите это здесь и скопируйте в
            нужное поле — перепечатывать из файла не нужно.
          </p>
          <pre className="max-h-96 overflow-auto rounded-lg border border-muted bg-canvas p-3 font-mono text-xs whitespace-pre-wrap text-ink-soft select-text">
            {text}
          </pre>
        </div>
      )}
    </section>
  );
}
