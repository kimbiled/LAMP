import type { StageKey } from "@/generated/prisma/enums";

// Причины отказа. Спрашиваются только на двух этапах — когда отказали
// мы и когда отказался кандидат. Остальные переходы остаются мгновенными,
// без единого лишнего нажатия.
//
// Причина хранится кодом, а не текстом: названия можно будет поправить
// позже, и старые записи не рассыплются.

export type RejectionSide = "WE" | "CANDIDATE";

export const WE_DECLINED_REASONS = [
  { code: "EXPERIENCE", label: "Мало опыта" },
  { code: "SKILLS", label: "Не хватает навыков" },
  { code: "TEST_FAILED", label: "Не прошёл техническую проверку" },
  { code: "SALARY", label: "Ожидания по зарплате выше" },
  { code: "CULTURE", label: "Не совпали по подходу к работе" },
  { code: "OTHER_CANDIDATE", label: "Взяли другого кандидата" },
  { code: "LOCATION", label: "Не подошёл по городу или графику" },
  { code: "JOB_CLOSED", label: "Вакансия закрыта или заморожена" },
  { code: "OTHER", label: "Другое" },
] as const;

export const CANDIDATE_DECLINED_REASONS = [
  { code: "OTHER_OFFER", label: "Принял другой оффер" },
  { code: "SALARY", label: "Не устроила зарплата" },
  { code: "CONDITIONS", label: "Не устроили условия или график" },
  { code: "STAYED", label: "Решил остаться на текущем месте" },
  { code: "COMPANY", label: "Не заинтересовала компания или продукт" },
  { code: "NO_CONTACT", label: "Перестал выходить на связь" },
  { code: "LONG_PROCESS", label: "Слишком долгий процесс" },
  { code: "OTHER", label: "Другое" },
] as const;

// На каком этапе чей отказ. Всё остальное причины не требует.
export function rejectionSide(key: StageKey | null): RejectionSide | null {
  if (key === "WE_DECLINED" || key === "REJECTED") return "WE";
  if (key === "CANDIDATE_DECLINED") return "CANDIDATE";
  return null;
}

export function reasonsFor(
  side: RejectionSide,
): readonly { code: string; label: string }[] {
  return side === "WE" ? WE_DECLINED_REASONS : CANDIDATE_DECLINED_REASONS;
}

// Код может прийти из старой записи или из чужой стороны отказа,
// поэтому ищем по обоим спискам.
export function rejectionLabel(code: string | null): string | null {
  if (!code) return null;
  const found = [...WE_DECLINED_REASONS, ...CANDIDATE_DECLINED_REASONS].find(
    (reason) => reason.code === code,
  );
  return found?.label ?? null;
}

export function isKnownReason(side: RejectionSide, code: string): boolean {
  return reasonsFor(side).some((reason) => reason.code === code);
}
