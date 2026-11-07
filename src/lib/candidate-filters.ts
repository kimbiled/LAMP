import { daysAgo } from "@/lib/time";
import { candidateVisibilityFilter } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";
import type { Role, SourceChannel } from "@/generated/prisma/enums";

// Фильтры списка кандидатов. Живут отдельно от страницы, потому что
// ими же пользуется выгрузка в Excel: что видно в списке, то и
// выгружается — ни человеком больше.

export type CandidateFilters = {
  q?: string;
  // id вакансии или "none" — кандидаты без вакансии.
  job?: string;
  stage?: string;
  recruiter?: string;
  city?: string;
  period?: string;
  experience?: string;
  tag?: string;
  channel?: string;
};

export const NO_JOB = "none";

export const PERIODS = [
  { value: "", label: "За всё время", days: 0 },
  { value: "7", label: "За 7 дней", days: 7 },
  { value: "30", label: "За 30 дней", days: 30 },
  { value: "90", label: "За 90 дней", days: 90 },
];

export const EXPERIENCE = [
  { value: "", label: "Любой опыт" },
  { value: "1", label: "От 1 года" },
  { value: "3", label: "От 3 лет" },
  { value: "5", label: "От 5 лет" },
  { value: "7", label: "От 7 лет" },
];

const CHANNELS: SourceChannel[] = ["COLD", "WARM", "REFERRAL"];

const FILTER_NAMES: (keyof CandidateFilters)[] = [
  "q",
  "job",
  "stage",
  "recruiter",
  "city",
  "period",
  "experience",
  "tag",
  "channel",
];

// Фильтры из адреса страницы: только известные поля и только строки.
export function readCandidateFilters(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): CandidateFilters {
  const filters: CandidateFilters = {};
  for (const name of FILTER_NAMES) {
    const value =
      params instanceof URLSearchParams ? params.get(name) : params[name];
    if (typeof value === "string") filters[name] = value;
  }
  return filters;
}

// Условие для базы. companyId и права берутся из сессии, а не из адреса:
// фильтр может только сузить выборку, но не расширить её.
export function candidateWhereFrom(
  filters: CandidateFilters,
  user: { id: string; role: Role; companyId: string },
): Prisma.CandidateWhereInput {
  const query = (filters.q ?? "").trim();

  // Условия по вакансии собираем в один объект: иначе ограничение
  // для нанимающего менеджера затёрлось бы фильтром по рекрутеру.
  const jobConditions: Record<string, string> = {};
  if (filters.recruiter) {
    jobConditions.recruiterId = filters.recruiter;
  }

  const days =
    PERIODS.find((item) => item.value === (filters.period ?? ""))?.days ?? 0;
  const since = daysAgo(days);

  const minExperience = Number(filters.experience);
  const channel = CHANNELS.find((item) => item === filters.channel);

  return {
    companyId: user.companyId,
    // Менеджер видит своих кандидатов и тех, кого собеседует.
    ...candidateVisibilityFilter(user),
    ...(Object.keys(jobConditions).length > 0 ? { job: jobConditions } : {}),
    ...(filters.job === NO_JOB
      ? { jobId: null }
      : filters.job
        ? { jobId: filters.job }
        : {}),
    ...(filters.stage ? { stageId: filters.stage } : {}),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.tag ? { tags: { some: { id: filters.tag } } } : {}),
    ...(channel ? { sourceChannel: channel } : {}),
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(Number.isFinite(minExperience) && minExperience > 0
      ? { experienceYears: { gte: minExperience } }
      : {}),
    ...(query
      ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query } },
            { email: { contains: query, mode: "insensitive" as const } },
            {
              currentPosition: { contains: query, mode: "insensitive" as const },
            },
            // Навык целиком: «Excel», «1С», «Figma».
            { skills: { has: query } },
            // Поиск по компаниям из опыта работы кандидата.
            {
              experience: {
                some: {
                  companyName: { contains: query, mode: "insensitive" as const },
                },
              },
            },
            // И по тексту самого резюме: слово из описания проекта
            // найдётся, даже если его нет ни в одном поле карточки.
            {
              resumes: {
                some: {
                  parsedText: { contains: query, mode: "insensitive" as const },
                },
              },
            },
          ],
        }
      : {}),
  };
}

// Адрес с теми же фильтрами — для кнопки выгрузки.
export function filtersToQuery(filters: CandidateFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string" && value.trim() !== "") params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}
