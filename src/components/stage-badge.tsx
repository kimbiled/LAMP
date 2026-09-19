import type { StageKey } from "@/generated/prisma/enums";

// Метка этапа подбора. Итоговые этапы выделяем цветом,
// остальные остаются нейтральными, чтобы доска не пестрила.

const STYLES: Record<string, string> = {
  OFFER: "bg-accent/25 text-ink",
  HIRED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-50 text-red-700",
  NO_RESPONSE: "bg-muted text-ink-soft",
};

export function StageBadge({
  name,
  stageKey,
}: {
  name: string;
  stageKey: StageKey | null;
}) {
  const style = (stageKey && STYLES[stageKey]) || "bg-muted text-ink";

  return (
    <span
      className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {name}
    </span>
  );
}
