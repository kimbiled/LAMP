"use client";

import { useTransition } from "react";
import { ArrowRight, Check } from "lucide-react";
import { moveCandidateToStage } from "@/app/actions/candidates";

// Полоса этапов подбора. Этап переключается нажатием, без перетаскивания:
// так удобнее и на ноутбуке, и на телефоне.

export type PipelineStage = {
  id: string;
  name: string;
  key: string | null;
  position: number;
};

const NEGATIVE_KEYS = ["REJECTED", "NO_RESPONSE"];

export function StagePipeline({
  candidateId,
  currentStageId,
  stages,
  canMove,
}: {
  candidateId: string;
  currentStageId: string;
  stages: PipelineStage[];
  canMove: boolean;
}) {
  const [pending, startTransition] = useTransition();

  // Отказ и «Не отвечает» стоят особняком: это не ступени воронки,
  // а выход из неё.
  const negative = stages.filter(
    (stage) => stage.key !== null && NEGATIVE_KEYS.includes(stage.key),
  );
  const main = stages.filter((stage) => !negative.includes(stage));

  const currentIndex = main.findIndex((stage) => stage.id === currentStageId);
  const nextStage =
    currentIndex >= 0 && currentIndex < main.length - 1
      ? main[currentIndex + 1]
      : null;

  // Перевод происходит сразу по нажатию, без подтверждения.
  // Ошибочный перевод легко исправить — нажать нужный этап,
  // а в истории кандидата видно каждое изменение.
  function move(stage: PipelineStage) {
    const formData = new FormData();
    formData.set("candidateId", candidateId);
    formData.set("stageId", stage.id);

    startTransition(async () => {
      await moveCandidateToStage(formData);
    });
  }

  return (
    <div className="rounded-xl border border-muted bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">Этап подбора</p>

        {canMove && nextStage && (
          <button
            type="button"
            disabled={pending}
            onClick={() => move(nextStage)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {nextStage.name}
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {main.map((stage, index) => {
          const isCurrent = stage.id === currentStageId;
          const isDone = currentIndex >= 0 && index < currentIndex;

          return (
            <button
              key={stage.id}
              type="button"
              disabled={!canMove || pending || isCurrent}
              onClick={() => move(stage)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition ${
                isCurrent
                  ? "bg-accent font-medium text-ink"
                  : isDone
                    ? "bg-muted text-ink"
                    : "border border-muted text-ink-soft"
              } ${canMove && !isCurrent ? "hover:border-ink-soft hover:text-ink" : ""} disabled:cursor-default`}
            >
              {isDone && <Check className="h-3.5 w-3.5" strokeWidth={2.4} />}
              {stage.name}
            </button>
          );
        })}
      </div>

      {negative.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {negative.map((stage) => {
            const isCurrent = stage.id === currentStageId;
            return (
              <button
                key={stage.id}
                type="button"
                disabled={!canMove || pending || isCurrent}
                onClick={() => move(stage)}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                  isCurrent
                    ? "bg-red-50 font-medium text-red-700"
                    : "border border-muted text-ink-soft hover:border-red-300 hover:text-red-600"
                } disabled:cursor-default`}
              >
                {stage.name}
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
}
