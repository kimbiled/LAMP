"use client";

import { changeJobPriority } from "@/app/actions/jobs";
import { InstantSelect } from "@/components/ui/instant-select";
import { JOB_PRIORITIES } from "@/lib/job-priority";
import type { JobPriority } from "@/generated/prisma/enums";

// Быстрая смена приоритета прямо на странице вакансии — рядом
// со сменой статуса. Приоритет меняется часто, и открывать для этого
// форму редактирования со всеми полями было бы перебором.

export function JobPrioritySelect({
  jobId,
  priority,
}: {
  jobId: string;
  priority: JobPriority;
}) {
  return (
    <InstantSelect
      value={priority}
      options={JOB_PRIORITIES.map((item) => ({
        value: item.value,
        label: `${item.label} приоритет`,
        icon: item.icon,
        tone: item.tone,
      }))}
      action={changeJobPriority}
      buildForm={(next) => ({ jobId, priority: next })}
      label="Приоритет вакансии"
    />
  );
}
