"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import { moveCandidateToStage } from "@/app/actions/candidates";
import { TONE_STYLES, stageTone } from "@/lib/stages";
import { reasonsFor, rejectionSide, type RejectionSide } from "@/lib/rejection";
import type { StageKey } from "@/generated/prisma/enums";

// Текущий этап кандидата и его смена.
// Этап выбирается в окне со списком — так видны все варианты сразу
// и ничего не нужно прокручивать вбок.
//
// Подтверждения нет нигде, кроме двух этапов отказа: там окно
// спрашивает причину, и её можно пропустить одним нажатием.

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
  // Если выбран этап отказа, окно переключается на второй шаг —
  // выбор причины. Здесь лежит этот этап.
  const [asking, setAsking] = useState<{
    stage: PipelineStage;
    side: RejectionSide;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [, startTransition] = useTransition();

  // Подсветка переключается сразу по нажатию, не дожидаясь сервера.
  const [activeStageId, setActiveStageId] = useOptimistic(currentStageId);

  const current = stages.find((stage) => stage.id === activeStageId);
  const tone = TONE_STYLES[stageTone(current?.key ?? null)];

  function close() {
    setOpen(false);
    setAsking(null);
    setReason("");
    setComment("");
  }

  function move(stage: PipelineStage, withReason: boolean) {
    close();

    const formData = new FormData();
    formData.set("candidateId", candidateId);
    formData.set("stageId", stage.id);
    if (withReason && reason) {
      formData.set("rejectionReason", reason);
      formData.set("rejectionComment", comment);
    }

    startTransition(async () => {
      setActiveStageId(stage.id);
      await moveCandidateToStage(formData);
    });
  }

  function pick(stage: PipelineStage) {
    const side = rejectionSide(stage.key);

    // Отказ — единственный случай, когда мы задерживаем на шаг.
    if (side) {
      setAsking({ stage, side });
      return;
    }

    move(stage, false);
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
          onClick={close}
        >
          <div
            className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-muted bg-surface p-4"
            onClick={(event) => event.stopPropagation()}
          >
            {asking ? (
              <>
                <button
                  type="button"
                  onClick={() => setAsking(null)}
                  className="inline-flex items-center gap-1.5 px-1 pb-2 text-xs text-ink-soft transition hover:text-ink"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />К
                  списку этапов
                </button>

                <p className="px-1 text-sm font-medium text-ink">
                  {asking.stage.name}
                </p>
                <p className="mt-1 px-1 text-xs text-ink-soft">
                  Причина пригодится в аналитике. Если некогда — нажмите
                  «Пропустить».
                </p>

                <ul className="mt-3 space-y-1">
                  {reasonsFor(asking.side).map((item) => {
                    const chosen = item.code === reason;

                    return (
                      <li key={item.code}>
                        <button
                          type="button"
                          onClick={() => setReason(chosen ? "" : item.code)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                            chosen
                              ? "bg-accent/25 font-medium text-ink"
                              : "text-ink hover:bg-muted"
                          }`}
                        >
                          {item.label}
                          {chosen && (
                            <Check
                              className="h-4 w-4 shrink-0"
                              strokeWidth={2.4}
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={2}
                  placeholder="Подробности — по желанию"
                  aria-label="Комментарий к отказу"
                  className="mt-3 w-full rounded-lg border border-muted bg-canvas px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/30"
                />

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => move(asking.stage, true)}
                    className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-hover"
                  >
                    Перевести
                  </button>
                  <button
                    type="button"
                    onClick={() => move(asking.stage, false)}
                    className="rounded-lg border border-muted px-4 py-2.5 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
                  >
                    Пропустить
                  </button>
                </div>
              </>
            ) : (
              <>
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
                          onClick={() => pick(stage)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                            isCurrent
                              ? `${stageStyles.badge} font-medium`
                              : "text-ink hover:bg-muted"
                          }`}
                        >
                          {stage.name}
                          {isCurrent && (
                            <Check
                              className="h-4 w-4 shrink-0"
                              strokeWidth={2.4}
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <button
                  type="button"
                  onClick={close}
                  className="mt-3 w-full rounded-lg border border-muted px-4 py-2.5 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
                >
                  Отмена
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
