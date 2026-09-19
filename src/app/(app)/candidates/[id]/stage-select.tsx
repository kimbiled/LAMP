"use client";

import { useTransition } from "react";
import { moveCandidateToStage } from "@/app/actions/candidates";

// Быстрая смена этапа прямо в карточке кандидата.
// Каждая смена попадает в историю.

export function StageSelect({
  candidateId,
  stageId,
  stages,
}: {
  candidateId: string;
  stageId: string;
  stages: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={stageId}
      disabled={pending}
      aria-label="Этап кандидата"
      onChange={(event) => {
        const formData = new FormData();
        formData.set("candidateId", candidateId);
        formData.set("stageId", event.target.value);
        startTransition(() => moveCandidateToStage(formData));
      }}
      className="rounded-lg border border-muted bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
    >
      {stages.map((stage) => (
        <option key={stage.id} value={stage.id}>
          {stage.name}
        </option>
      ))}
    </select>
  );
}
