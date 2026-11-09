import { ChevronsDown, ChevronsUp, Equal } from "lucide-react";
import type { JobPriority } from "@/generated/prisma/enums";
import { JOB_PRIORITY_LABELS } from "@/lib/labels";

// Приоритет вакансии: чем занимаемся в первую очередь.
//
// Порядок в этом списке совпадает с порядком значений в базе — по нему
// же вакансии сортируются в списке, поэтому срочное всегда сверху.
//
// Цвета как у светофора: красный — бросай всё, янтарный — обычная
// работа, серый — подождёт. Иконка и цвет одни и те же в форме
// и на метке, чтобы приоритет узнавался с одного взгляда.
export const JOB_PRIORITIES: {
  value: JobPriority;
  label: string;
  // Пояснение под кнопкой в форме: словами, что значит этот выбор.
  hint: string;
  icon: typeof ChevronsUp;
  // Кнопка в форме, когда приоритет выбран.
  active: string;
  // Метка в списке вакансий и в шапке карточки.
  badge: string;
  // Цвет иконки в выпадающем списке.
  tone: string;
}[] = [
  {
    value: "HIGH",
    label: JOB_PRIORITY_LABELS.HIGH,
    hint: "закрываем в первую очередь",
    icon: ChevronsUp,
    active: "border-danger bg-danger-soft text-danger-ink",
    badge: "bg-danger-soft text-danger-ink",
    tone: "text-danger",
  },
  {
    value: "MEDIUM",
    label: JOB_PRIORITY_LABELS.MEDIUM,
    hint: "обычная работа по плану",
    icon: Equal,
    active: "border-accent bg-glow text-ink",
    badge: "bg-glow text-ink",
    tone: "text-accent-ink",
  },
  {
    value: "LOW",
    label: JOB_PRIORITY_LABELS.LOW,
    hint: "ищем без срока, когда есть время",
    icon: ChevronsDown,
    active: "border-ink-soft bg-muted text-ink",
    badge: "bg-muted text-ink-soft",
    tone: "text-ink-soft",
  },
];

export function jobPriority(value: JobPriority) {
  // find по трём значениям, а не Record: тот же список нужен и перебором
  // (кнопки в форме), и поиском (метка). Держать две копии — значит
  // однажды поправить одну и забыть другую.
  return JOB_PRIORITIES.find((item) => item.value === value) ?? null;
}
