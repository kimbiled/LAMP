import type { HistoryType, JobStatus, Role } from "@/generated/prisma/enums";

// Человеческие названия для значений, которые в базе хранятся по-английски.

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Администратор",
  RECRUITER: "Рекрутер",
  HIRING_MANAGER: "Нанимающий менеджер",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  OPEN: "Открыта",
  PAUSED: "Приостановлена",
  CLOSED: "Закрыта",
};

export const CURRENCIES = [
  { code: "KZT", label: "₸ тенге" },
  { code: "RUB", label: "₽ рубли" },
  { code: "USD", label: "$ доллары" },
  { code: "EUR", label: "€ евро" },
];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  KZT: "₸",
  RUB: "₽",
  USD: "$",
  EUR: "€",
};

export const HISTORY_LABELS: Record<HistoryType, string> = {
  CANDIDATE_CREATED: "Кандидат добавлен",
  CANDIDATE_UPDATED: "Карточка обновлена",
  STAGE_CHANGED: "Смена этапа",
  RESUME_UPLOADED: "Загружено резюме",
  INTERVIEW_SCHEDULED: "Назначено интервью",
  INTERVIEW_COMPLETED: "Интервью проведено",
  FEEDBACK_ADDED: "Добавлен фидбэк",
  SHARE_LINK_CREATED: "Создана ссылка «Поделиться»",
};
