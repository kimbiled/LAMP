"use client";

import { useRef, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteJob } from "@/app/actions/jobs";
import { useConfirm } from "@/components/ui/dialog";
import { buttonClass } from "@/components/ui/styles";

// Удаление вакансии. Как и у кандидата, сначала спрашиваем в окне Skillo:
// вернуть удалённую вакансию будет нельзя.

export function DeleteJobButton({
  jobId,
  jobTitle,
  candidateCount,
}: {
  jobId: string;
  jobTitle: string;
  candidateCount: number;
}) {
  const confirm = useConfirm();
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  async function ask() {
    const confirmed = await confirm({
      title: `Удалить вакансию «${jobTitle}»?`,
      message:
        candidateCount > 0
          ? `Кандидаты (${candidateCount}) останутся в базе, но без привязки к этой вакансии. Это действие нельзя отменить. Если вакансия просто закрыта, лучше поставьте статус «Закрыта».`
          : "Это действие нельзя отменить.",
      confirmLabel: "Удалить навсегда",
      danger: true,
    });
    if (!confirmed || !form.current) return;
    const data = new FormData(form.current);
    startTransition(() => deleteJob(data));
  }

  return (
    <form ref={form} onSubmit={(event) => event.preventDefault()}>
      <input type="hidden" name="jobId" value={jobId} />
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
        Удалить вакансию
      </button>
    </form>
  );
}
