"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import { moveCandidateToStage } from "@/app/actions/candidates";
import { TONE_STYLES, stageGroup, STAGE_GROUPS, stageTone } from "@/lib/stages";
import { Modal } from "@/components/ui/dialog";
import { NETWORK_ERROR, useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/styles";
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
  const toast = useToast();

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
      try {
        const result = await moveCandidateToStage(formData);
        // При ошибке подсветка сама вернётся на прежний этап,
        // а человек увидит, почему.
        if (result.ok) {
          if (result.message) toast.success(result.message);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error(NETWORK_ERROR);
      }
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
          <p className="text-sm text-ink-soft">Этап подбора</p>
          <p className="mt-0.5 text-base font-medium text-ink">
            {current?.name ?? "Этап не выбран"}
          </p>
        </div>

        {canMove && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={buttonClass({ variant: "primary" })}
          >
            Сменить этап
            <ChevronDown className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>

      <Modal
        open={open}
        onClose={close}
        title={asking ? asking.stage.name : "Выберите этап"}
        size="sm"
      >
            {asking ? (
              <>
                <button
                  type="button"
                  onClick={() => setAsking(null)}
                  className={buttonClass({ variant: "ghost", size: "sm", className: "-ml-2 mb-2" })}
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  К списку этапов
                </button>

                <p className="text-sm text-ink-soft">
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
                          aria-pressed={chosen}
                          className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                            chosen
                              ? "bg-success-soft font-medium text-success-ink"
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
                  className="mt-3 w-full rounded-lg border border-line-strong bg-canvas px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-ink focus:ring-[3px] focus:ring-accent/40"
                />

                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    onClick={() => move(asking.stage, false)}
                    className={buttonClass({ variant: "secondary" })}
                  >
                    Без причины
                  </button>
                  <button
                    type="button"
                    onClick={() => move(asking.stage, true)}
                    className={buttonClass({ variant: "primary" })}
                  >
                    Перевести
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Этапы разложены по смыслу: куда человек движется,
                    где он на паузе и где подбор закончился. Одним
                    списком из одиннадцати строк в них путались. */}
                <div className="space-y-4">
                  {STAGE_GROUPS.map((group) => {
                    const inGroup = stages.filter(
                      (stage) => stageGroup(stage.key) === group.id,
                    );
                    if (inGroup.length === 0) return null;

                    return (
                      <div key={group.id}>
                        <p className="px-1 pb-1 text-xs font-medium tracking-wide text-ink-soft uppercase">
                          {group.label}
                        </p>
                        <ul className="space-y-1">
                          {inGroup.map((stage) => {
                            const isCurrent = stage.id === activeStageId;
                            const stageStyles = TONE_STYLES[stageTone(stage.key)];

                            return (
                              <li key={stage.id}>
                                <button
                                  type="button"
                                  onClick={() => pick(stage)}
                                  aria-current={isCurrent ? "true" : undefined}
                                  className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                                    isCurrent
                                      ? `${stageStyles.badge} font-medium`
                                      : "text-ink hover:bg-muted"
                                  }`}
                                >
                                  {stage.name}
                                  {isCurrent && (
                                    <Check className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden />
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={close}
                  className={buttonClass({ variant: "secondary", full: true, className: "mt-4" })}
                >
                  Отмена
                </button>
              </>
            )}
      </Modal>
    </div>
  );
}
