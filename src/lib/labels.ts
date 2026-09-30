import type {
  FeedbackResult,
  HistoryType,
  InterviewStatus,
  InterviewType,
  JobStatus,
  Role,
  SourceChannel,
} from "@/generated/prisma/enums";

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

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  HR: "HR-интервью",
  TECHNICAL: "Техническое интервью",
  MANAGER: "Интервью с руководителем",
  FINAL: "Финальное интервью",
  OTHER: "Другое",
};

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  SCHEDULED: "Назначено",
  COMPLETED: "Проведено",
  CANCELED: "Отменено",
};

export const SOURCE_CHANNEL_LABELS: Record<SourceChannel, string> = {
  COLD: "Холодный поиск",
  WARM: "Тёплый контакт",
  REFERRAL: "Реферал",
};

export const FEEDBACK_RESULT_LABELS: Record<FeedbackResult, string> = {
  POSITIVE: "Положительный",
  NEGATIVE: "Отрицательный",
  EXTRA_STAGE: "Нужен дополнительный этап",
};
