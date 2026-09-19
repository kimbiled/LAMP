"use client";

import { useTransition } from "react";
import { changeJobStatus } from "@/app/actions/jobs";
import type { JobStatus } from "@/generated/prisma/enums";

// Быстрая смена статуса вакансии прямо на её странице.

export function JobStatusSelect({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={pending}
      aria-label="Статус вакансии"
      onChange={(event) => {
        const formData = new FormData();
        formData.set("jobId", jobId);
        formData.set("status", event.target.value);
        startTransition(() => changeJobStatus(formData));
      }}
      className="rounded-lg border border-muted bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
    >
      <option value="OPEN">Открыта</option>
      <option value="PAUSED">Приостановлена</option>
      <option value="CLOSED">Закрыта</option>
    </select>
  );
}
