"use client";

import { changeJobStatus } from "@/app/actions/jobs";
import { InstantSelect } from "@/components/ui/instant-select";
import type { JobStatus } from "@/generated/prisma/enums";

// Быстрая смена статуса вакансии прямо на её странице.

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Открыта" },
  { value: "PAUSED", label: "Приостановлена" },
  { value: "CLOSED", label: "Закрыта" },
];

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
