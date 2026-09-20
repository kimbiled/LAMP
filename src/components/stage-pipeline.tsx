"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import { moveCandidateToStage } from "@/app/actions/candidates";
import { TONE_STYLES, stageTone } from "@/lib/stages";
import type { StageKey } from "@/generated/prisma/enums";

// Текущий этап кандидата и его смена.
// Этап выбирается в окне со списком — так видны все варианты сразу
// и ничего не нужно прокручивать вбок.

export type PipelineStage = {
  id: string;
  name: string;
  key: StageKey | null;
  position: number;
};

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
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Подсветка переключается сразу по нажатию, не дожидаясь сервера.
  const [activeStageId, setActiveStageId] = useOptimistic(currentStageId);

  const current = stages.find((stage) => stage.id === activeStageId);
  const tone = TONE_STYLES[stageTone(current?.key ?? null)];

  function move(stage: PipelineStage) {
    setOpen(false);

    const formData = new FormData();
    formData.set("candidateId", candidateId);
    formData.set("stageId", stage.id);

    startTransition(async () => {
      setActiveStageId(stage.id);
      await moveCandidateToStage(formData);
    });
  }

  return (
    <div className={`rounded-xl border p-4 ${tone.border} ${tone.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-ink-soft">Этап подбора</p>
          <p className="mt-0.5 text-base font-medium text-ink">
            {current?.name ?? "Этап не выбран"}
          </p>
        </div>

        {canMove && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink transition hover:bg-accent-hover"
          >
            Сменить этап
            <ChevronDown className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-strong/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-muted bg-surface p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="px-1 pb-2 text-sm font-medium text-ink">
              Выберите этап
            </p>

            <ul className="space-y-1">
              {stages.map((stage) => {
                const isCurrent = stage.id === activeStageId;
                const stageStyles = TONE_STYLES[stageTone(stage.key)];

                return (
                  <li key={stage.id}>
                    <button
                      type="button"
                      onClick={() => move(stage)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                        isCurrent
                          ? `${stageStyles.badge} font-medium`
                          : "text-ink hover:bg-muted"
                      }`}
                    >
                      {stage.name}
                      {isCurrent && (
                        <Check className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full rounded-lg border border-muted px-4 py-2.5 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
