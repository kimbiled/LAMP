"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { CANDIDATE_FORMS, DAY_FORMS, plural } from "@/lib/format";
import { TONE_STYLES, type StageTone } from "@/lib/stages";

// Кандидаты вакансии: вкладки по этапам и карточки под ними.
//
// Раньше это был узкий список в боковой колонке на 320 пикселей: все
// этапы подряд в одной прокрутке, по три строки на человека. Разобрать,
// сколько кандидатов на каком этапе, можно было только прокруткой.
//
// Теперь этап выбирается вкладкой со счётчиком, а люди показаны
// карточками во всю ширину — по две-три в ряд.

export type JobCandidate = {
  id: string;
  fullName: string;
  currentPosition: string | null;
  city: string | null;
  stageId: string;
  hasPhoto: boolean;
  // Сколько дней человек сидит на текущем этапе. Считается на сервере,
  // чтобы у всех было одно и то же число независимо от часового пояса.
  daysOnStage: number;
};

export type JobStage = {
  id: string;
  name: string;
  tone: StageTone;
};

// С какого срока простой на этапе стоит заметить. Две недели —
// граница, после которой кандидат обычно уже остыл.
const SLOW_DAYS = 14;

export function JobCandidates({
  stages,
  candidates,
}: {
  stages: JobStage[];
  candidates: JobCandidate[];
}) {
  const [active, setActive] = useState<string>("");

  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(candidate.stageId, (counts.get(candidate.stageId) ?? 0) + 1);
  }

  // Пустые этапы вкладками не показываем: на вакансию с тремя людьми
  // приходилось бы одиннадцать вкладок, из которых восемь пустых.
  const filled = stages.filter((stage) => (counts.get(stage.id) ?? 0) > 0);

  // Если выбранный этап опустел после перехода — возвращаемся ко «Всем».
  const current = filled.some((stage) => stage.id === active) ? active : "";

  const shown = current
    ? candidates.filter((candidate) => candidate.stageId === current)
    : candidates;

  const stageById = new Map(stages.map((stage) => [stage.id, stage]));

  if (candidates.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-muted bg-surface p-10 text-center">
        <p className="text-sm text-ink-soft">
          На эту вакансию пока нет кандидатов.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-1.5">
        <Tab
          label="Все"
          count={candidates.length}
          active={current === ""}
          onClick={() => setActive("")}
        />

        {filled.map((stage) => (
          <Tab
            key={stage.id}
            label={stage.name}
            count={counts.get(stage.id) ?? 0}
            active={current === stage.id}
            tone={stage.tone}
            onClick={() => setActive(stage.id)}
          />
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((candidate) => {
          const stage = stageById.get(candidate.stageId);
          const tone = TONE_STYLES[stage?.tone ?? "muted"];
          const slow = candidate.daysOnStage >= SLOW_DAYS;

          return (
            <Link
              key={candidate.id}
              href={`/candidates/${candidate.id}`}
              className={`flex h-full flex-col rounded-xl border p-4 transition hover:brightness-95 ${tone.border} ${tone.card}`}
            >
              <div className="flex items-start gap-3">
                <Avatar
                  name={candidate.fullName}
                  size="md"
                  candidateId={candidate.id}
                  hasPhoto={candidate.hasPhoto}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-strong">
                    {candidate.fullName}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {candidate.currentPosition ?? "должность не указана"}
                  </p>
                  {candidate.city && (
                    <p className="truncate text-xs text-ink-soft">
                      {candidate.city}
                    </p>
                  )}
                </div>
              </div>

              {/* Этап показываем только на вкладке «Все»: внутри вкладки
                  он и так в её названии. */}
              <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3">
                {current === "" && stage && (
                  <span className="rounded-md bg-surface/80 px-2 py-0.5 text-xs text-ink">
                    {stage.name}
                  </span>
                )}

                <span
                  className={`text-xs ${slow ? "font-medium text-amber-700" : "text-ink-soft"}`}
                >
                  {candidate.daysOnStage === 0
                    ? "сегодня"
                    : `${candidate.daysOnStage} ${plural(candidate.daysOnStage, DAY_FORMS)} на этапе`}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-ink-soft">
        Показано {shown.length} {plural(shown.length, CANDIDATE_FORMS)}.
        Жёлтым отмечены те, кто не двигался дольше двух недель.
      </p>
    </section>
  );
}

function Tab({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: StageTone;
  onClick: () => void;
}) {
  const colors = tone ? TONE_STYLES[tone] : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
        active
          ? "bg-ink-strong font-medium text-canvas"
          : `${colors ? colors.card : "text-ink-soft"} hover:bg-muted hover:text-ink`
      }`}
    >
      {label}
      <span className={active ? "text-canvas/70" : "text-ink-soft/80"}>
        {count}
      </span>
    </button>
  );
}
