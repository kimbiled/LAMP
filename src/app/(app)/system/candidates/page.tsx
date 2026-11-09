import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/superadmin";
import { Avatar } from "@/components/avatar";
import { StageBadge } from "@/components/stage-badge";
import { formatDate } from "@/lib/format";
import { TONE_STYLES, stageTone } from "@/lib/stages";

export const metadata: Metadata = { title: "Все кандидаты — Skillo" };

const selectClass =
  "rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink focus:ring-[3px] focus:ring-accent/40";

// Кусочек резюме вокруг найденного слова.
function snippet(text: string | null, query: string): string | null {
  if (!text) return null;

  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return null;

  const from = Math.max(0, at - 60);
  const to = Math.min(text.length, at + query.length + 80);
  const cut = text.slice(from, to).replace(/\s+/g, " ").trim();

  return `${from > 0 ? "…" : ""}${cut}${to < text.length ? "…" : ""}`;
}

export default async function SystemCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; company?: string; city?: string }>;
}) {
  // Раздел владельца системы: здесь границы компаний намеренно сняты.
  // Всем остальным этот адрес отвечает «страница не найдена».
  await requireOwner();

  const filters = await searchParams;
  const query = (filters.q ?? "").trim();

  const [companies, cityRows, candidates] = await Promise.all([
    db.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.candidate.findMany({
      where: { city: { not: null } },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
    db.candidate.findMany({
      where: {
        ...(filters.company ? { companyId: filters.company } : {}),
        ...(filters.city ? { city: filters.city } : {}),
        ...(query
          ? {
              OR: [
                { fullName: { contains: query, mode: "insensitive" as const } },
                { phone: { contains: query } },
                { email: { contains: query, mode: "insensitive" as const } },
                {
                  currentPosition: {
                    contains: query,
                    mode: "insensitive" as const,
                  },
                },
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
        company: { select: { name: true } },
        job: { select: { title: true } },
        stage: { select: { name: true, key: true } },
        tags: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        _count: {
          select: { feedbacks: true, interviews: true, resumes: true },
        },
        resumes: {
          where: query
            ? { parsedText: { contains: query, mode: "insensitive" as const } }
            : { id: "" },
          select: { parsedText: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);

  const hasFilters = Boolean(query || filters.company || filters.city);

  const cities = cityRows
    .map((row) => row.city)
    .filter((city): city is string => Boolean(city));

  return (
    <div>
      <BackButton fallbackHref="/system" fallbackLabel="К разделу «Система»" />

      <h1 className="mt-4 text-xl font-semibold text-ink-strong">
        Все кандидаты
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Единая база по всем компаниям Skillo. Видна только владельцу системы.
        {candidates.length > 0 ? ` Найдено: ${candidates.length}` : ""}
      </p>

      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
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
            aria-label="Поиск по всей базе"
            className="w-full rounded-lg border border-line-strong bg-surface py-2.5 pr-3 pl-9 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-ink focus:ring-[3px] focus:ring-accent/40"
          />
        </div>

        <select
          name="company"
          defaultValue={filters.company ?? ""}
          aria-label="Компания"
          className={selectClass}
        >
          <option value="">Все компании</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
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

        <button
          type="submit"
          className="rounded-lg border border-line-strong px-4 py-2.5 text-sm text-ink transition hover:bg-canvas"
        >
          Найти
        </button>
      </form>

      {hasFilters && (
        <Link
          href="/system/candidates"
          className="mt-3 inline-block text-xs text-ink-soft underline transition hover:text-ink"
        >
          Сбросить фильтры
        </Link>
      )}

      {candidates.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="text-sm text-ink-soft">
            {hasFilters
              ? "По этому запросу никого нет."
              : "Кандидатов пока нет."}
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {candidates.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/system/candidates/${candidate.id}`}
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
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-ink-soft">
                    {candidate.company.name}
                  </span>
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
                  {formatDate(candidate.createdAt)} · резюме:{" "}
                  {candidate._count.resumes} · интервью:{" "}
                  {candidate._count.interviews} · отзывов:{" "}
                  {candidate._count.feedbacks}
                </p>

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
                        className="rounded bg-muted px-1.5 py-0.5 text-xs text-ink-soft"
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

      <p className="mt-4 text-xs text-ink-soft">
        Карточки открываются только на чтение: править данные компании можно из
        самой компании, чтобы у изменений всегда был понятный автор.
      </p>
    </div>
  );
}
