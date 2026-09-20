import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { can, jobVisibilityFilter } from "@/lib/permissions";
import { Avatar } from "@/components/avatar";
import { StageBadge } from "@/components/stage-badge";
import { formatDate } from "@/lib/format";
import { TONE_STYLES, stageTone } from "@/lib/stages";

export const metadata: Metadata = { title: "Кандидаты — LAMP" };

const PERIODS = [
  { value: "", label: "За всё время", days: 0 },
  { value: "7", label: "За 7 дней", days: 7 },
  { value: "30", label: "За 30 дней", days: 30 },
  { value: "90", label: "За 90 дней", days: 90 },
];

const EXPERIENCE = [
  { value: "", label: "Любой опыт" },
  { value: "1", label: "От 1 года" },
  { value: "3", label: "От 3 лет" },
  { value: "5", label: "От 5 лет" },
  { value: "7", label: "От 7 лет" },
];

const selectClass =
  "rounded-lg border border-muted bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

// Кусочек резюме вокруг найденного слова — чтобы было видно,
// почему человек попал в выдачу.
function snippet(text: string | null, query: string): string | null {
  if (!text) return null;

  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return null;

  const from = Math.max(0, at - 60);
  const to = Math.min(text.length, at + query.length + 80);
  const cut = text.slice(from, to).replace(/\s+/g, " ").trim();

  return `${from > 0 ? "…" : ""}${cut}${to < text.length ? "…" : ""}`;
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    job?: string;
    stage?: string;
    recruiter?: string;
    city?: string;
    period?: string;
    experience?: string;
    tag?: string;
  }>;
}) {
  const scope = await getScope();
  const filters = await searchParams;
  const query = (filters.q ?? "").trim();

  // Условия по вакансии собираем в один объект: иначе ограничение
  // для нанимающего менеджера затёрлось бы фильтром по рекрутеру.
  const jobConditions: Record<string, string> = {};
  if (!can(scope.session.user.role, "candidates.viewAll")) {
    jobConditions.hiringManagerId = scope.session.user.id;
  }
  if (filters.recruiter) {
    jobConditions.recruiterId = filters.recruiter;
  }

  const days =
    PERIODS.find((item) => item.value === (filters.period ?? ""))?.days ?? 0;
  const since = days > 0 ? new Date(Date.now() - days * 86_400_000) : null;

  const minExperience = Number(filters.experience);

  // Все запросы уходят одновременно.
  const [jobs, stages, recruiters, cityRows, tags, candidates] =
    await Promise.all([
      db.job.findMany({
        where: {
          companyId: scope.companyId,
          ...jobVisibilityFilter(scope.session.user),
        },
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
      }),
      db.stage.findMany({
        where: { companyId: scope.companyId },
        select: { id: true, name: true },
        orderBy: { position: "asc" },
      }),
      db.user.findMany({
        where: {
          companyId: scope.companyId,
          role: { in: ["ADMIN", "RECRUITER"] },
        },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
      db.candidate.findMany({
        where: { companyId: scope.companyId, city: { not: null } },
        select: { city: true },
        distinct: ["city"],
        orderBy: { city: "asc" },
      }),
      db.tag.findMany({
        where: { companyId: scope.companyId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.candidate.findMany({
        where: {
          companyId: scope.companyId,
          ...(Object.keys(jobConditions).length > 0
            ? { job: jobConditions }
            : {}),
          ...(filters.job ? { jobId: filters.job } : {}),
          ...(filters.stage ? { stageId: filters.stage } : {}),
          ...(filters.city ? { city: filters.city } : {}),
          ...(filters.tag ? { tags: { some: { id: filters.tag } } } : {}),
          ...(since ? { createdAt: { gte: since } } : {}),
          ...(Number.isFinite(minExperience) && minExperience > 0
            ? { experienceYears: { gte: minExperience } }
            : {}),
          ...(query
            ? {
                OR: [
                  {
                    fullName: { contains: query, mode: "insensitive" as const },
                  },
                  { phone: { contains: query } },
                  { email: { contains: query, mode: "insensitive" as const } },
                  {
                    currentPosition: {
                      contains: query,
                      mode: "insensitive" as const,
                    },
                  },
                  // Поиск по компаниям из опыта работы кандидата.
                  {
                    experience: {
                      some: {
                        companyName: {
                          contains: query,
                          mode: "insensitive" as const,
                        },
                      },
                    },
                  },
                  // И по тексту самого резюме: слово из описания проекта
                  // найдётся, даже если его нет ни в одном поле карточки.
                  {
                    resumes: {
                      some: {
                        parsedText: {
                          contains: query,
                          mode: "insensitive" as const,
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        include: {
          job: { select: { title: true } },
          stage: { select: { name: true, key: true } },
          tags: { select: { id: true, name: true }, orderBy: { name: "asc" } },
          experience: {
            where: query
              ? { companyName: { contains: query, mode: "insensitive" } }
              : undefined,
            select: { companyName: true },
            take: 1,
          },
          // Текст резюме тяжёлый, поэтому тянем его только при поиске.
          // Без запроса условие заведомо ни с чем не совпадает.
          resumes: {
            where: query
              ? {
                  parsedText: { contains: query, mode: "insensitive" as const },
                }
              : { id: "" },
            select: { parsedText: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

  const cities = cityRows
    .map((row) => row.city)
    .filter((city): city is string => Boolean(city));

  const hasFilters = Boolean(
    query ||
    filters.job ||
    filters.stage ||
    filters.recruiter ||
    filters.city ||
    filters.period ||
    filters.experience ||
    filters.tag,
  );

  const extraFiltersUsed = Boolean(
    filters.recruiter ||
    filters.city ||
    filters.period ||
    filters.experience ||
    filters.tag,
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-strong">Кандидаты</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {candidates.length > 0
              ? `Найдено: ${candidates.length}`
              : "Пока никого нет"}
          </p>
        </div>

        {scope.can("candidates.create") && (
          <Link
            href="/candidates/new"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-hover sm:w-auto"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Добавить кандидата
          </Link>
        )}
      </div>

      <form className="mt-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
              strokeWidth={1.8}
            />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Имя, телефон, почта, должность, компания, текст резюме"
              aria-label="Поиск кандидатов"
              className="w-full rounded-lg border border-muted bg-surface py-2.5 pr-3 pl-9 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <select
            name="job"
            defaultValue={filters.job ?? ""}
            aria-label="Вакансия"
            className={selectClass}
          >
            <option value="">Все вакансии</option>
            {jobs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>

          <select
            name="stage"
            defaultValue={filters.stage ?? ""}
            aria-label="Этап"
            className={selectClass}
          >
            <option value="">Все этапы</option>
            {stages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="rounded-lg border border-muted px-4 py-2.5 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
          >
            Найти
          </button>
        </div>

        <details open={extraFiltersUsed} className="group">
          <summary className="cursor-pointer text-sm text-ink-soft transition hover:text-ink">
            Ещё фильтры
          </summary>

          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <select
              name="tag"
              defaultValue={filters.tag ?? ""}
              aria-label="Метка"
              className={selectClass}
            >
              <option value="">Все метки</option>
              {tags.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <select
              name="recruiter"
              defaultValue={filters.recruiter ?? ""}
              aria-label="Рекрутер"
              className={selectClass}
            >
              <option value="">Все рекрутеры</option>
              {recruiters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                </option>
              ))}
            </select>

            <select
              name="city"
              defaultValue={filters.city ?? ""}
              aria-label="Город"
              className={selectClass}
            >
              <option value="">Все города</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>

            <select
              name="period"
              defaultValue={filters.period ?? ""}
              aria-label="Дата добавления"
              className={selectClass}
            >
              {PERIODS.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              name="experience"
              defaultValue={filters.experience ?? ""}
              aria-label="Опыт"
              className={selectClass}
            >
              {EXPERIENCE.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </details>

        {hasFilters && (
          <Link
            href="/candidates"
            className="inline-block text-xs text-ink-soft underline transition hover:text-ink"
          >
            Сбросить фильтры
          </Link>
        )}
      </form>

      {candidates.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-muted bg-surface p-10 text-center">
          <p className="text-sm text-ink-soft">
            {hasFilters
              ? "По этому запросу никого не нашлось."
              : scope.can("candidates.create")
                ? "Добавьте первого кандидата — вручную или загрузив резюме."
                : "Вам пока не назначено ни одного кандидата."}
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-muted overflow-hidden rounded-xl border border-muted bg-surface">
          {candidates.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/candidates/${candidate.id}`}
              className={`flex items-center gap-3 p-4 transition hover:brightness-95 ${TONE_STYLES[stageTone(candidate.stage.key)].card}`}
            >
              <Avatar name={candidate.fullName} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-ink">
                    {candidate.fullName}
                  </p>
                  <StageBadge
                    name={candidate.stage.name}
                    stageKey={candidate.stage.key}
                  />
                </div>
                <p className="truncate text-xs text-ink-soft">
                  {candidate.currentPosition ?? "Должность не указана"}
                  {candidate.city ? ` · ${candidate.city}` : ""}
                </p>
                <p className="truncate text-xs text-ink-soft">
                  {candidate.job?.title ?? "Без вакансии"} · добавлен{" "}
                  {formatDate(candidate.createdAt)}
                </p>
                {query && candidate.experience.length > 0 && (
                  <p className="truncate text-xs text-ink-soft">
                    Опыт работы: {candidate.experience[0].companyName}
                  </p>
                )}

                {query && candidate.resumes.length > 0 && (
                  <p className="mt-1 line-clamp-2 text-xs text-ink-soft italic">
                    Из резюме: {snippet(candidate.resumes[0].parsedText, query)}
                  </p>
                )}

                {candidate.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {candidate.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-ink-soft"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
