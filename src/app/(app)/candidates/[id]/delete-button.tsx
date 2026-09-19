"use client";

import { Trash2 } from "lucide-react";
import { deleteCandidate } from "@/app/actions/candidates";

// Удаление кандидата. Перед отправкой спрашиваем подтверждение —
// вернуть удалённого кандидата будет нельзя.

export function DeleteCandidateButton({
  candidateId,
  candidateName,
}: {
  candidateId: string;
  candidateName: string;
}) {
  return (
    <form
      action={deleteCandidate}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Удалить кандидата «${candidateName}»? Вместе с ним удалятся история, интервью и фидбэки. Это действие нельзя отменить.`,
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="candidateId" value={candidateId} />
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg border border-muted px-3 py-2 text-sm text-ink-soft transition hover:border-red-300 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
        Удалить
      </button>
    </form>
  );
}
