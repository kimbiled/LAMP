"use client";

import { changeJobStatus } from "@/app/actions/jobs";
import { InstantSelect } from "@/components/ui/instant-select";
import type { JobStatus } from "@/generated/prisma/enums";
import { JOB_STATUSES } from "@/lib/job-status";

// Быстрая смена статуса вакансии прямо на её странице.
// У каждого статуса своя иконка и цвет — те же, что на метке в списке.

const STATUS_OPTIONS = JOB_STATUSES.map((item) => ({
  value: item.value,
  label: item.label,
  icon: item.icon,
  tone: item.tone,
  surface: `${item.badge} font-medium`,
}));

export function JobStatusSelect({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}) {
  return (
    <InstantSelect
      value={status}
      options={STATUS_OPTIONS}
      action={changeJobStatus}
      buildForm={(next) => ({ jobId, status: next })}
      label="Статус вакансии"
    />
  );
}
