import { Archive, CirclePause, CirclePlay } from "lucide-react";
import type { JobStatus } from "@/generated/prisma/enums";
import { JOB_STATUS_LABELS } from "@/lib/labels";

// Статусы вакансии: цвет и иконка в одном месте — для метки в списке
// и для выпадающего списка на странице вакансии.
//
// Три разных цвета, чтобы статус узнавался с одного взгляда:
// зелёный — идёт работа, янтарный — пауза, серый — закрыта.
export const JOB_STATUSES: {
  value: JobStatus;
  label: string;
  icon: typeof CirclePlay;
  badge: string;
  tone: string;
}[] = [
  {
    value: "OPEN",
    label: JOB_STATUS_LABELS.OPEN,
    icon: CirclePlay,
    badge: "bg-open-soft text-open-ink",
    tone: "text-open-dot",
  },
  {
    value: "PAUSED",
    label: JOB_STATUS_LABELS.PAUSED,
    icon: CirclePause,
    badge: "bg-paused-soft text-paused-ink",
    tone: "text-paused-dot",
  },
  {
    value: "CLOSED",
    label: JOB_STATUS_LABELS.CLOSED,
    icon: Archive,
    badge: "bg-closed-soft text-closed-ink",
    tone: "text-closed-dot",
  },
];

export function jobStatus(value: JobStatus) {
  return JOB_STATUSES.find((item) => item.value === value) ?? JOB_STATUSES[0];
}
