import type { StageKey } from "@/generated/prisma/enums";
import { TONE_STYLES, stageTone } from "@/lib/stages";

// Метка этапа подбора. Цвет говорит о результате:
// зелёный — оффер, красный — наш отказ, серый — пауза или молчание,
// жёлтый — работа идёт.

export function StageBadge({
  name,
  stageKey,
}: {
  name: string;
  stageKey: StageKey | null;
}) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
        TONE_STYLES[stageTone(stageKey)].badge
      }`}
    >
      {name}
    </span>
  );
}
