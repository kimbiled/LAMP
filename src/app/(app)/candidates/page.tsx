import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Download, FileJson, Plus, Search, SlidersHorizontal } from "lucide-react";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { jobVisibilityFilter } from "@/lib/permissions";
import { Avatar } from "@/components/avatar";
import { StageBadge } from "@/components/stage-badge";
import { formatDate } from "@/lib/format";
import { TONE_STYLES, stageTone } from "@/lib/stages";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/pagination";
import { badgeClass, buttonClass } from "@/components/ui/styles";
import {
  EXPERIENCE,
  NO_JOB,
  PERIODS,
  candidateWhereFrom,
  filtersToQuery,
  readCandidateFilters,
} from "@/lib/candidate-filters";
import { SOURCE_CHANNELS } from "@/lib/source-channel";

export const metadata: Metadata = { title: "Кандидаты — LAMP" };

const selectClass =
  "w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-accent";

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
    channel?: string;
    page?: string;
  }>;
}) {
  const scope = await getScope();
  const filters = readCandidateFilters(await searchParams);
  const query = (filters.q ?? "").trim();

  // Раньше список молча обрезался на 200 и писал «Найдено: 200».
  // Теперь — честное общее число и страницы по 50.
  const page = parsePage((await searchParams).page);
  const candidateWhere = candidateWhereFrom(filters, {
    ...scope.session.user,
    companyId: scope.companyId,
  });
  const canExport = scope.can("candidates.export");

  // Все запросы уходят одновременно.
  const [jobs, stages, recruiters, cityRows, tags, candidates, total] =
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
        where: candidateWhere,
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
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.candidate.count({ where: candidateWhere }),
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
    filters.tag ||
    filters.channel,
  );

  const extraFiltersUsed = Boolean(
    filters.recruiter ||
    filters.city ||
    filters.period ||
    filters.experience ||
    filters.tag ||
    filters.channel,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-strong">Кандидаты</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {total > 0
              ? `${hasFilters ? "Найдено" : "Всего"}: ${total}`
              : "Пока никого нет"}
          </p>
        </div>

        {scope.can("candidates.create") && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link
              href="/candidates/import"
              className={buttonClass({ variant: "secondary", className: "flex-1 sm:flex-none" })}
            >
              <FileJson className="h-4 w-4" strokeWidth={1.8} />
              Импорт с hh
            </Link>

            <Link
              href="/candidates/new"
              className={buttonClass({ variant: "primary", className: "flex-1 sm:flex-none" })}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Добавить кандидата
            </Link>
          </div>
        )}
      </div>

      <form className="mt-5 space-y-3">
        {/* Поиск — главное поле. На средних экранах он занимает всю
            строку, а списки встают под ним: раньше на ноутбуке списки
            забирали место, и от поля оставалось «Имя, телефо». */}
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="relative sm:col-span-full xl:col-span-1">
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
              className="w-full rounded-lg border border-line-strong bg-surface py-2.5 pr-3 pl-9 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-ink focus:ring-2 focus:ring-accent"
            />
          </div>

          <select
            name="job"
            defaultValue={filters.job ?? ""}
            aria-label="Вакансия"
            className={selectClass}
          >
            <option value="">Все вакансии</option>
            <option value={NO_JOB}>Без вакансии</option>
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
            className={buttonClass({ variant: "primary", className: "h-auto py-2.5" })}
          >
            <Search className="h-4 w-4" strokeWidth={2} aria-hidden />
            Найти
          </button>
        </div>

        <details open={extraFiltersUsed} className="group">
          <summary className="-ml-2 inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-ink-soft transition hover:bg-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Ещё фильтры
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" strokeWidth={1.8} aria-hidden />
          </summary>

          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
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

            <select
              name="channel"
              defaultValue={filters.channel ?? ""}
              aria-label="Канал привлечения"
              className={selectClass}
            >
              <option value="">Все каналы</option>
              {SOURCE_CHANNELS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {hasFilters && (
            <Link
              href="/candidates"
              className="inline-block text-xs text-ink-soft underline transition hover:text-ink"
            >
              Сбросить фильтры
            </Link>
          )}

          {/* Выгружаются ровно те, кто сейчас в списке (по всем страницам).
              Обычная ссылка, а не кнопка формы: файл скачивается сам. */}
          {canExport && total > 0 && (
            <a
              href={`/api/candidates/export${filtersToQuery(filters)}`}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              <Download className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              Выгрузить в Excel ({total})
            </a>
          )}
        </div>
      </form>

      {candidates.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="text-sm text-ink-soft">
            {hasFilters
              ? "По этому запросу никого не нашлось."
              : scope.can("candidates.create")
                ? "Добавьте первого кандидата — вручную или загрузив резюме."
                : "Вам пока не назначено ни одного кандидата."}
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {candidates.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/candidates/${candidate.id}`}
              className={`flex items-center gap-3 p-4 transition hover:brightness-95 ${TONE_STYLES[stageTone(candidate.stage.key)].card}`}
            >
              <Avatar
                name={candidate.fullName}
                candidateId={candidate.id}
                hasPhoto={Boolean(candidate.photoKey)}
              />

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
                        className={badgeClass("neutral")}
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

      <Pagination
        page={page}
        total={total}
        basePath="/candidates"
        params={filters}
      />
    </div>
  );
}
