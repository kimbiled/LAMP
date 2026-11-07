"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from "lucide-react";
import type { StageKey } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import {
  createStage,
  deleteStage,
  moveStage,
  renameStage,
} from "@/app/actions/stages";
import { STAGE_GROUPS, TONE_STYLES, stageGroup, stageTone } from "@/lib/stages";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { NETWORK_ERROR, useToast } from "@/components/ui/toast";

// Конструктор этапов подбора в настройках.
//
// Каждая строка — этап: номер, название (правится прямо в строке),
// стрелки «выше/ниже» и удаление. Если на этапе есть кандидаты,
// при удалении спрашиваем, куда их перевести.

export type StageRow = {
  id: string;
  name: string;
  key: StageKey | null;
  candidateCount: number;
};

type Run = (
  action: (formData: FormData) => Promise<ActionResult>,
  fields: Record<string, string>,
  onOk?: () => void,
) => void;

function groupLabel(key: StageKey | null) {
  const group = stageGroup(key);
  return STAGE_GROUPS.find((item) => item.id === group)?.label ?? "";
}

export function StageEditor({ stages }: { stages: StageRow[] }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");

  const run: Run = (action, fields, onOk) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);

    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result.ok) {
          if (result.message) toast.success(result.message);
          onOk?.();
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error(NETWORK_ERROR);
      }
    });
  };

  return (
    <div>
      <ol className="mt-4 space-y-2">
        {stages.map((stage, index) => (
          <StageLine
            // Имя в ключе: после переименования строка начинается заново
            // с сохранённым названием, а не с тем, что было в поле.
            key={`${stage.id}:${stage.name}`}
            stage={stage}
            number={index + 1}
            first={index === 0}
            last={index === stages.length - 1}
            others={stages.filter((item) => item.id !== stage.id)}
            canDelete={stages.length > 2}
            pending={pending}
            run={run}
          />
        ))}
      </ol>

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          run(createStage, { name: newName }, () => setNewName(""));
        }}
      >
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Новый этап, например «Тестовое задание»"
          maxLength={60}
          aria-label="Название нового этапа"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={pending || newName.trim().length < 2}
          className={buttonClass({ variant: "primary" })}
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Добавить этап
        </button>
      </form>
      <p className="mt-2 text-xs text-ink-soft">
        Новый этап встаёт после последнего рабочего этапа, перед паузами
        и отказами. Новые кандидаты попадают в этап под номером 1.
      </p>
    </div>
  );
}

function StageLine({
  stage,
  number,
  first,
  last,
  others,
  canDelete,
  pending,
  run,
}: {
  stage: StageRow;
  number: number;
  first: boolean;
  last: boolean;
  others: StageRow[];
  canDelete: boolean;
  pending: boolean;
  run: Run;
}) {
  const [name, setName] = useState(stage.name);
  const [deleting, setDeleting] = useState(false);
  const [moveTo, setMoveTo] = useState("");

  const changed = name.trim() !== stage.name && name.trim().length >= 2;
  const tone = TONE_STYLES[stageTone(stage.key)];

  return (
    <li className="rounded-lg bg-canvas px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-medium text-ink">
          {number}
        </span>

        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (changed) run(renameStage, { stageId: stage.id, name });
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            aria-label={`Название этапа ${number}`}
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-ink outline-none transition hover:border-line focus:border-ink focus:bg-surface"
          />
          {changed && (
            <>
              <button
                type="submit"
                disabled={pending}
                className={buttonClass({ variant: "primary", size: "icon-sm" })}
                aria-label="Сохранить название"
                title="Сохранить название"
              >
                <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setName(stage.name)}
                className={buttonClass({ variant: "ghost", size: "icon-sm" })}
                aria-label="Отменить"
                title="Отменить"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            </>
          )}
        </form>

        <span className={`rounded-md px-2 py-0.5 text-xs ${tone.badge}`}>
          {groupLabel(stage.key)}
        </span>
        <span className="w-16 text-right text-xs text-ink-soft" title="Кандидатов на этапе">
          {stage.candidateCount} канд.
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pending || first}
            onClick={() => run(moveStage, { stageId: stage.id, direction: "up" })}
            className={buttonClass({ variant: "ghost", size: "icon-sm" })}
            aria-label="Выше"
            title="Выше"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </button>
          <button
            type="button"
            disabled={pending || last}
            onClick={() => run(moveStage, { stageId: stage.id, direction: "down" })}
            className={buttonClass({ variant: "ghost", size: "icon-sm" })}
            aria-label="Ниже"
            title="Ниже"
          >
            <ArrowDown className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </button>
          <button
            type="button"
            disabled={pending || !canDelete}
            onClick={() => setDeleting((value) => !value)}
            className={buttonClass({ variant: "ghost", size: "icon-sm", className: "hover:text-danger" })}
            aria-label="Удалить этап"
            title={canDelete ? "Удалить этап" : "Должно остаться хотя бы два этапа"}
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      </div>

      {deleting && (
        <div className="mt-2 rounded-lg border border-danger-line bg-surface p-3 text-sm">
          <p className="text-ink">
            Удалить этап «{stage.name}»?
            {stage.key && (
              <span className="text-ink-soft">
                {" "}Это системный этап: на нём строятся цвета и часть аналитики.
              </span>
            )}
          </p>

          {stage.candidateCount > 0 && (
            <label className="mt-2 block text-ink-soft">
              На этапе кандидатов: {stage.candidateCount}. Перевести их в:
              <select
                value={moveTo}
                onChange={(event) => setMoveTo(event.target.value)}
                className={`${inputClass} mt-1.5`}
              >
                <option value="">Выберите этап</option>
                {others.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleting(false)}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={pending || (stage.candidateCount > 0 && !moveTo)}
              onClick={() =>
                run(deleteStage, { stageId: stage.id, moveToStageId: moveTo }, () =>
                  setDeleting(false),
                )
              }
              className={buttonClass({ variant: "danger", size: "sm" })}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              Удалить этап
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
