"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { CANDIDATE_FORMS, DAY_FORMS, plural } from "@/lib/format";
import { LayoutGrid, SquareKanban } from "lucide-react";
import { TONE_STYLES, type StageGroup, type StageTone } from "@/lib/stages";
import type { RejectionSide } from "@/lib/rejection";
import { JobBoard } from "./job-board";

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
  // После скольких дней на этапе человека подсвечивать: общий срок
  // компании или свой срок рекрутера, который его завёл.
  staleDays: number;
};

export type JobStage = {
  id: string;
  name: string;
  tone: StageTone;
  group: StageGroup;
  rejectionSide: RejectionSide | null;
};


export function JobCandidates({
  stages,
  candidates,
  canMove,
  action,
}: {
  stages: JobStage[];
  candidates: JobCandidate[];
  canMove: boolean;
  // Кнопка «Добавить кандидата» — в одной строке с заголовком
  // и переключателем вида, а не отдельной ступенькой над ними.
  action?: React.ReactNode;
}) {
  // Выбранный вид и вкладка этапа живут в адресе страницы (?view=…&stage=…).
  // Раньше они хранились только в памяти страницы: открыл карточку
  // кандидата, нажал «Назад» — и фильтр сбрасывался на «Все».
  // Теперь браузер возвращает тот же адрес, а с ним и выбор.
  const params = useSearchParams();
  const [active, setActiveState] = useState<string>(params.get("stage") ?? "");
  // Рекрутеру по умолчанию доска: на ней кандидатов двигают.
  // Тому, кто только смотрит, привычнее карточки.
  const urlView = params.get("view");
  const [view, setViewState] = useState<"board" | "cards">(
    urlView === "board" || urlView === "cards" ? urlView : canMove ? "board" : "cards",
  );

  function remember(key: string, value: string) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    // replaceState, а не push: переключение вкладки — не новая
    // страница, и «Назад» не должен по ним шагать.
    window.history.replaceState(window.history.state, "", url);
  }

  function setActive(value: string) {
    setActiveState(value);
    remember("stage", value);
  }

  function setView(value: "board" | "cards") {
    setViewState(value);
    remember("view", value);
  }

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

  const header = (switcher?: React.ReactNode) => (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <h2 className="text-base font-semibold text-ink-strong">
        Кандидаты
        <span className="ml-1.5 font-normal text-ink-soft">{candidates.length}</span>
      </h2>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {switcher}
        {action}
      </div>
    </div>
  );

  if (candidates.length === 0) {
    return (
      <section>
        {header()}
        <div className="rounded-xl border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="text-sm text-ink-soft">
            На эту вакансию пока нет кандидатов.
          </p>
        </div>
      </section>
    );
  }

  const viewSwitch = (
    <div role="group" aria-label="Вид" className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-surface p-0.5">
      {(
        [
          { id: "board", label: "Доска", icon: SquareKanban },
          { id: "cards", label: "Карточки", icon: LayoutGrid },
        ] as const
      ).map((item) => {
        const Icon = item.icon;
        const on = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={on}
            onClick={() => setView(item.id)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition ${
              on ? "bg-ink-strong font-medium text-canvas" : "text-ink-soft hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </button>
        );
      })}
    </div>
  );

  if (view === "board") {
    return (
      <section>
        {header(viewSwitch)}
        <JobBoard stages={stages} candidates={candidates} canMove={canMove} />
      </section>
    );
  }

  return (
    <section>
      {header(viewSwitch)}
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
          const slow = candidate.daysOnStage >= candidate.staleDays;

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
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-ink">
                    {stage.name}
                  </span>
                )}

                <span
                  className={`text-xs ${slow ? "font-medium text-warning-ink" : "text-ink-soft"}`}
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
        Показано {shown.length} {plural(shown.length, CANDIDATE_FORMS)}. Жёлтым
        отмечены те, кто стоит на этапе дольше срока простоя (задаётся в «Настройках»).
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
      aria-pressed={active}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
        active
          ? "bg-ink-strong font-medium text-canvas"
          : `${colors ? colors.card : "text-ink-soft"} hover:bg-muted hover:text-ink`
      }`}
    >
      {label}
      <span className={active ? "text-canvas/70" : "text-ink-soft"}>
        {count}
      </span>
    </button>
  );
}
