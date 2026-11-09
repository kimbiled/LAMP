// Срок простоя: сколько дней кандидат может стоять на одном этапе,
// прежде чем его подсветят как «застрявшего».
//
// Общий срок задаёт администратор (Company.staleDays). Рекрутер может
// задать свой — он действует только для кандидатов, которых завёл
// он сам (User.staleDays). У кого своего нет — общий.

export const DEFAULT_STALE_DAYS = 14;

export function staleLimit(
  companyDays: number | null | undefined,
  creator: { role: string; staleDays: number | null } | null | undefined,
): number {
  if (creator?.role === "RECRUITER" && creator.staleDays) {
    return creator.staleDays;
  }
  return companyDays || DEFAULT_STALE_DAYS;
}
