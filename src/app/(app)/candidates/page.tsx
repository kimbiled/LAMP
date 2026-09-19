import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { candidateVisibilityFilter, jobVisibilityFilter } from "@/lib/permissions";
import { Avatar } from "@/components/avatar";
import { StageBadge } from "@/components/stage-badge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Кандидаты — LAMP" };

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; job?: string; stage?: string }>;
}) {
  const scope = await getScope();
  const { q, job, stage } = await searchParams;
  const query = (q ?? "").trim();

  const [jobs, stages] = await Promise.all([
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
  ]);

  const candidates = await db.candidate.findMany({
    where: {
      companyId: scope.companyId,
      // Нанимающий менеджер видит только кандидатов своих вакансий.
      ...candidateVisibilityFilter(scope.session.user),
      ...(job ? { jobId: job } : {}),
      ...(stage ? { stageId: stage } : {}),
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
            ],
          }
        : {}),
    },
    include: {
      job: { select: { title: true } },
      stage: { select: { name: true, key: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

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
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Добавить кандидата
          </Link>
        )}
      </div>

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
            placeholder="Имя, телефон, почта, должность"
            aria-label="Поиск кандидатов"
            className="w-full rounded-lg border border-muted bg-surface py-2.5 pr-3 pl-9 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>

        <select
          name="job"
          defaultValue={job ?? ""}
          aria-label="Вакансия"
          className="rounded-lg border border-muted bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
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
          defaultValue={stage ?? ""}
          aria-label="Этап"
          className="rounded-lg border border-muted bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
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
      </form>

      {candidates.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-muted bg-surface p-10 text-center">
          <p className="text-sm text-ink-soft">
            {query || job || stage
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
              className="flex items-center gap-3 p-4 transition hover:bg-canvas"
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
