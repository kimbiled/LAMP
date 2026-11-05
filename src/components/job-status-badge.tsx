import type { JobStatus } from "@/generated/prisma/enums";
import { JOB_STATUS_LABELS } from "@/lib/labels";

// Цветная метка статуса вакансии.

const STYLES: Record<JobStatus, string> = {
  OPEN: "bg-khaki-soft text-khaki-ink",
  PAUSED: "bg-muted text-ink-soft",
  CLOSED: "bg-ink-strong/10 text-ink-soft",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
