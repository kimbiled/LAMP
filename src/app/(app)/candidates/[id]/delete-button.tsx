"use client";

import { useRef, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteCandidate } from "@/app/actions/candidates";
import { useConfirm } from "@/components/ui/dialog";
import { buttonClass } from "@/components/ui/styles";

// Удаление кандидата. Перед отправкой спрашиваем подтверждение
// в окне Skillo — вернуть удалённого кандидата будет нельзя.

export function DeleteCandidateButton({
  candidateId,
  candidateName,
}: {
  candidateId: string;
  candidateName: string;
}) {
  const confirm = useConfirm();
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  async function ask() {
    const confirmed = await confirm({
      title: `Удалить кандидата «${candidateName}»?`,
      message:
        "Вместе с ним удалятся история, интервью и отзывы. Это действие нельзя отменить.",
      confirmLabel: "Удалить навсегда",
      danger: true,
    });
    if (!confirmed || !form.current) return;
    const data = new FormData(form.current);
    startTransition(() => deleteCandidate(data));
  }

  return (
    <form ref={form} onSubmit={(event) => event.preventDefault()}>
      <input type="hidden" name="candidateId" value={candidateId} />
      <button
        type="button"
        onClick={ask}
        disabled={pending}
        className={buttonClass({ variant: "danger-outline" })}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        )}
        Удалить кандидата
      </button>
    </form>
  );
}
