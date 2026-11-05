import type { JobPriority } from "@/generated/prisma/enums";
import { jobPriority } from "@/lib/job-priority";

// Метка приоритета вакансии.
//
// У среднего приоритета метки нет намеренно: это значение по умолчанию,
// и оно стоит у большинства вакансий. Если отмечать все, метка
// перестаёт выделять что-либо — а нужна она именно для этого.
// Поэтому в списке видно только то, что отличается от обычного:
// красное «Высокий» и серое «Фоновый».

export function JobPriorityBadge({ priority }: { priority: JobPriority }) {
  if (priority === "MEDIUM") return null;

  const item = jobPriority(priority);
  if (!item) return null;

  const Icon = item.icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${item.badge}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {item.label}
    </span>
  );
}
