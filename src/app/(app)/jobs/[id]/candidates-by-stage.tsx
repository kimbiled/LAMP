import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { formatDate } from "@/lib/format";
import { TONE_STYLES, stageTone } from "@/lib/stages";
import type { StageKey } from "@/generated/prisma/enums";

// Кандидаты вакансии в боковой панели: вертикальный список,
// сгруппированный по этапам. Цвет строки показывает результат —
// зелёный оффер, красный наш отказ, серый пауза, жёлтый работа идёт.

type Candidate = {
  id: string;
  fullName: string;
  currentPosition: string | null;
  city: string | null;
  stageId: string;
  stageChangedAt: Date;
};

type Stage = {
  id: string;
  name: string;
  key: StageKey | null;
};

export function CandidatesByStage({
  stages,
  candidates,
}: {
  stages: Stage[];
  candidates: Candidate[];
}) {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(candidate.stageId, (counts.get(candidate.stageId) ?? 0) + 1);
  }

  const filled = stages.filter((stage) => (counts.get(stage.id) ?? 0) > 0);

  return (
    <aside className="overflow-hidden rounded-xl border border-muted bg-surface">
      <div className="flex items-center justify-between border-b border-muted px-4 py-2.5">
        <p className="text-sm font-medium text-ink">Кандидаты</p>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-ink-soft">
          {candidates.length}
        </span>
      </div>

      {candidates.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-soft">
          На эту вакансию пока нет кандидатов.
        </p>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto">
          {filled.map((stage) => {
            const tone = TONE_STYLES[stageTone(stage.key)];

            return (
              <section key={stage.id}>
                <div className="sticky top-0 flex items-center justify-between border-y border-muted bg-canvas px-4 py-1.5">
                  <p className="text-xs font-medium text-ink">{stage.name}</p>
                  <span className="text-xs text-ink-soft">
                    {counts.get(stage.id)}
                  </span>
                </div>

                <ul className="divide-y divide-muted">
                  {candidates
                    .filter((candidate) => candidate.stageId === stage.id)
                    .map((candidate) => (
                      <li key={candidate.id}>
                        <Link
                          href={`/candidates/${candidate.id}`}
                          className={`flex items-center gap-3 px-4 py-3 transition hover:brightness-95 ${tone.card}`}
                        >
                          <Avatar name={candidate.fullName} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-ink">
                              {candidate.fullName}
                            </p>
                            <p className="truncate text-xs text-ink-soft">
                              {candidate.currentPosition ?? "Должность не указана"}
                            </p>
                            <p className="truncate text-xs text-ink-soft">
                              с {formatDate(candidate.stageChangedAt)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}
