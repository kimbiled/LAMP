"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { moveCandidateToStage } from "@/app/actions/candidates";
import { Modal } from "@/components/ui/dialog";
import { NETWORK_ERROR, useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/styles";
import { DAY_FORMS, plural } from "@/lib/format";
import { TONE_STYLES } from "@/lib/stages";
import { reasonsFor, type RejectionSide } from "@/lib/rejection";
import type { JobCandidate, JobStage } from "./job-candidates";

// Доска вакансии: колонка на каждый этап, кандидаты — карточками.
//
// Перевести кандидата можно двумя способами:
//   — перетащить карточку мышью в другую колонку;
//   — выбрать этап в списке на самой карточке (с клавиатуры, с телефона
//     и для тех, кому неудобно тянуть мышью).
// При переводе в отказ, как и в карточке кандидата, спрашиваем причину.
//
// Раньше этап менялся только внутри карточки кандидата: чтобы
// разобрать 30 откликов, нужно было открыть 30 страниц.

const SLOW_DAYS = 14;

export function JobBoard({
  stages,
  candidates,
  canMove,
}: {
  stages: JobStage[];
  candidates: JobCandidate[];
  canMove: boolean;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [asking, setAsking] = useState<{
    candidate: JobCandidate;
    stage: JobStage;
    side: RejectionSide;
  } | null>(null);
  const [reason, setReason] = useState("");

  // Карточка переезжает сразу, не дожидаясь сервера.
  const [placed, place] = useOptimistic(
    candidates,
    (list, move: { id: string; stageId: string }) =>
      list.map((item) =>
        item.id === move.id ? { ...item, stageId: move.stageId, daysOnStage: 0 } : item,
      ),
  );

  // Колонки: все ступени воронки (даже пустые — в них можно перетащить)
  // и паузы с отказами, только если там кто-то есть.
  const columns = stages.filter(
    (stage) =>
      stage.group === "progress" ||
      placed.some((candidate) => candidate.stageId === stage.id),
  );

  function send(candidate: JobCandidate, stage: JobStage, withReason: string) {
    const formData = new FormData();
    formData.set("candidateId", candidate.id);
    formData.set("stageId", stage.id);
    if (withReason) formData.set("rejectionReason", withReason);

    startTransition(async () => {
      place({ id: candidate.id, stageId: stage.id });
      try {
        const result = await moveCandidateToStage(formData);
        if (result.ok) {
          toast.success(`${candidate.fullName} → «${stage.name}»`);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error(NETWORK_ERROR);
      }
    });
  }

  function move(candidateId: string, stageId: string) {
    const candidate = placed.find((item) => item.id === candidateId);
    const stage = stages.find((item) => item.id === stageId);
    if (!candidate || !stage || candidate.stageId === stageId) return;

    if (stage.rejectionSide) {
      setReason("");
      setAsking({ candidate, stage, side: stage.rejectionSide });
      return;
    }
    send(candidate, stage, "");
  }

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="flex min-w-max gap-3">
          {columns.map((stage) => {
            const inColumn = placed.filter((candidate) => candidate.stageId === stage.id);
            const tone = TONE_STYLES[stage.tone];
            const isOver = overStage === stage.id && dragging !== null;

            return (
              <section
                key={stage.id}
                aria-label={`${stage.name}: ${inColumn.length}`}
                onDragOver={(event) => {
                  if (!canMove || !dragging) return;
                  event.preventDefault();
                  setOverStage(stage.id);
                }}
                onDragLeave={() => setOverStage((current) => (current === stage.id ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData("text/plain");
                  setOverStage(null);
                  setDragging(null);
                  if (id) move(id, stage.id);
                }}
                className={`flex w-64 shrink-0 flex-col rounded-xl border p-2 transition ${
                  isOver ? "border-ink bg-warning-soft" : "border-line bg-warm"
                }`}
              >
                <h3 className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className={`truncate rounded-md px-2 py-0.5 text-sm font-medium ${tone.badge}`}>
                    {stage.name}
                  </span>
                  <span className="text-sm text-ink-soft">{inColumn.length}</span>
                </h3>

                <ul className="mt-1 flex min-h-24 flex-col gap-2">
                  {inColumn.map((candidate) => {
                    const slow = candidate.daysOnStage >= SLOW_DAYS;
                    return (
                      <li
                        key={candidate.id}
                        draggable={canMove}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", candidate.id);
                          event.dataTransfer.effectAllowed = "move";
                          setDragging(candidate.id);
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setOverStage(null);
                        }}
                        className={`rounded-lg border border-line bg-surface p-3 shadow-sm ${
                          canMove ? "cursor-grab active:cursor-grabbing" : ""
                        } ${dragging === candidate.id ? "opacity-50" : ""}`}
                      >
                        <Link
                          href={`/candidates/${candidate.id}`}
                          className="flex items-start gap-2.5 hover:underline"
                        >
                          <Avatar
                            name={candidate.fullName}
                            size="sm"
                            candidateId={candidate.id}
                            hasPhoto={candidate.hasPhoto}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">
                              {candidate.fullName}
                            </span>
                            <span className="block truncate text-xs text-ink-soft">
                              {candidate.currentPosition ?? "должность не указана"}
                            </span>
                          </span>
                        </Link>

                        <p
                          className={`mt-2 text-xs ${slow ? "font-medium text-warning-ink" : "text-ink-soft"}`}
                        >
                          {candidate.daysOnStage === 0
                            ? "на этапе с сегодня"
                            : `${candidate.daysOnStage} ${plural(candidate.daysOnStage, DAY_FORMS)} на этапе`}
                        </p>

                        {canMove && (
                          <select
                            value={candidate.stageId}
                            onChange={(event) => move(candidate.id, event.target.value)}
                            aria-label={`Этап: ${candidate.fullName}`}
                            className="mt-2 h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-xs text-ink"
                          >
                            {stages.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </li>
                    );
                  })}
                  {inColumn.length === 0 && (
                    <li className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-ink-soft">
                      {canMove ? "Перетащите сюда" : "Пусто"}
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <Modal
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={asking ? `${asking.candidate.fullName} → «${asking.stage.name}»` : ""}
        size="sm"
      >
        {asking && (
          <>
            <p className="text-sm text-ink-soft">
              Причина пригодится в аналитике. Можно не выбирать.
            </p>
            <ul className="mt-3 space-y-1">
              {reasonsFor(asking.side).map((item) => {
                const chosen = item.code === reason;
                return (
                  <li key={item.code}>
                    <button
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => setReason(chosen ? "" : item.code)}
                      className={`flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm transition ${
                        chosen ? "bg-danger-soft font-medium text-danger-ink" : "text-ink hover:bg-muted"
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => setAsking(null)}
                className={buttonClass({ variant: "secondary" })}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  send(asking.candidate, asking.stage, reason);
                  setAsking(null);
                }}
                className={buttonClass({ variant: "danger" })}
              >
                Перевести в отказ
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
