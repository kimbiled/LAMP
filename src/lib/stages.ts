import type { StageKey } from "@/generated/prisma/enums";

// Этапы подбора, которые создаются автоматически для каждой новой компании.
// key — системное обозначение, по нему строится аналитика.
// Позже администратор сможет добавлять свои этапы: у них key будет пустым.

export const DEFAULT_STAGES: { name: string; key: StageKey }[] = [
  { name: "Новый", key: "NEW" },
  { name: "Первичный контакт", key: "CONTACT" },
  { name: "Назначено интервью", key: "INTERVIEW_SCHEDULED" },
  { name: "Интервью проведено", key: "INTERVIEW_DONE" },
  { name: "Техническое интервью", key: "TECH_INTERVIEW" },
  { name: "Финальное интервью", key: "FINAL_INTERVIEW" },
  { name: "Оффер", key: "OFFER" },
  { name: "Найм", key: "HIRED" },
  { name: "Отказ", key: "REJECTED" },
  { name: "Не отвечает", key: "NO_RESPONSE" },
];
