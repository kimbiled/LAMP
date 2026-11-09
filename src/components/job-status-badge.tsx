import type { JobStatus } from "@/generated/prisma/enums";
import { jobStatus } from "@/lib/job-status";

// Цветная метка статуса вакансии: зелёная «Открыта»,
// янтарная «Приостановлена», серая «Закрыта».

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const item = jobStatus(status);
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${item.badge}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      {item.label}
    </span>
  );
}
