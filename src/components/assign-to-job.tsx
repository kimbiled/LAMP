"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, UserPlus } from "lucide-react";
import { assignCandidateToJob } from "@/app/actions/candidates";
import { buttonClass } from "@/components/ui/styles";
import { Select } from "@/components/ui/select";
import { NETWORK_ERROR, useToast } from "@/components/ui/toast";

// Добавить кандидата из базы на вакансию — одной кнопкой.
// Кандидат встаёт на первый этап, прошлые отзывы и история остаются.

function useAssign() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function assign(candidateId: string, jobId: string, onDone?: () => void) {
    const formData = new FormData();
    formData.set("candidateId", candidateId);
    formData.set("jobId", jobId);
    startTransition(async () => {
      try {
        const result = await assignCandidateToJob(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Добавлен на вакансию");
        onDone?.();
        router.refresh();
      } catch {
        toast.error(NETWORK_ERROR);
      }
    });
  }

  return { pending, assign };
}

// Кнопка в списке «Подобрать из базы»: вакансия уже известна.
export function AssignToJobButton({
  candidateId,
  jobId,
  already,
}: {
  candidateId: string;
  jobId: string;
  already: boolean;
}) {
  const [added, setAdded] = useState(already);
  const { pending, assign } = useAssign();

  if (added) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 px-2 text-xs font-medium text-success-ink">
        <Check className="size-4" strokeWidth={2} aria-hidden />
        На вакансии
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => assign(candidateId, jobId, () => setAdded(true))}
      className={buttonClass({ variant: "primary", size: "sm" })}
    >
      <UserPlus className="size-4" strokeWidth={1.8} aria-hidden />
      {pending ? "Добавляем…" : "Добавить на вакансию"}
    </button>
  );
}

// В карточке кандидата: выбрать открытую вакансию и перевести на неё.
export function AssignToJobPicker({
  candidateId,
  currentJobId,
  jobs,
}: {
  candidateId: string;
  currentJobId: string | null;
  jobs: { id: string; title: string }[];
}) {
  const choices = jobs.filter((job) => job.id !== currentJobId);
  const [jobId, setJobId] = useState(choices[0]?.id ?? "");
  const { pending, assign } = useAssign();

  if (choices.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={jobId}
        onChange={setJobId}
        options={choices.map((job) => ({ value: job.id, label: job.title }))}
        label="Вакансия"
        className="min-w-56 flex-1"
      />
      <button
        type="button"
        disabled={pending || !jobId}
        onClick={() => assign(candidateId, jobId)}
        className={buttonClass({ variant: "secondary" })}
      >
        <UserPlus className="size-4" strokeWidth={1.8} aria-hidden />
        {pending ? "Добавляем…" : "На вакансию"}
      </button>
    </div>
  );
}
