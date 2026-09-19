import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { formatDate } from "@/lib/format";
import type { StageKey } from "@/generated/prisma/enums";

// Кандидаты вакансии, сгруппированные по этапам подбора.
// Этап меняется в карточке кандидата, перетаскивать ничего не нужно.

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

  if (candidates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-muted bg-surface p-10 text-center">
        <p className="text-sm text-ink-soft">
          На эту вакансию пока нет кандидатов.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {stages.map((stage) => {
          const count = counts.get(stage.id) ?? 0;
          return (
            <span
              key={stage.id}
              className={`rounded-md px-2 py-1 text-xs ${
                count > 0
                  ? "bg-muted text-ink"
                  : "border border-muted text-ink-soft"
              }`}
            >
              {stage.name}
              <span className={count > 0 ? "font-medium" : ""}> {count}</span>
            </span>
          );
        })}
      </div>

      {filled.map((stage) => (
        <section
          key={stage.id}
          className="overflow-hidden rounded-xl border border-muted bg-surface"
        >
          <div className="flex items-center justify-between border-b border-muted px-4 py-2.5">
            <p className="text-sm font-medium text-ink">{stage.name}</p>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-ink-soft">
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
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-canvas"
                  >
                    <Avatar name={candidate.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
                        {candidate.fullName}
                      </p>
                      <p className="truncate text-xs text-ink-soft">
                        {candidate.currentPosition ?? "Должность не указана"}
                        {candidate.city ? ` · ${candidate.city}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-soft">
                      с {formatDate(candidate.stageChangedAt)}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
