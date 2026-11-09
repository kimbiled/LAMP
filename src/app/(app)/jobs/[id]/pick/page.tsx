import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { candidateVisibilityFilter, jobVisibilityFilter } from "@/lib/permissions";
import { jobKeywords, rankMatches } from "@/lib/job-match";
import { caseVariants } from "@/lib/search-variants";
import { rejectionLabel } from "@/lib/rejection";
import { formatDate } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { BackButton } from "@/components/back-button";
import { AssignToJobButton } from "@/components/assign-to-job";
import { buttonClass, inputClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Подбор из базы — Skillo" };

// Подбор из базы на вакансию.
//
// Кого рассматривали раньше — на другую вакансию или на эту же год
// назад, — тот остался в базе вместе с резюме и отзывами. Здесь его
// находят по описанию вакансии и одной кнопкой ставят на неё.
//
// Поиск идёт по словам из описания: должность, опыт, навыки и текст
// резюме. Чем больше слов совпало, тем выше человек в списке.

const MAX_RESULTS = 40;

export default async function PickFromBasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const scope = await getScope();
  if (!scope.can("candidates.move")) notFound();

  const { id } = await params;
  const job = await db.job.findFirst({
    where: { id, companyId: scope.companyId, ...jobVisibilityFilter(scope.session.user) },
    select: { id: true, title: true, requirements: true },
  });
  if (!job) notFound();

  const raw = (await searchParams).q;
  const query = (raw ?? `${job.title}\n${job.requirements ?? ""}`).slice(0, 2000).trim();
  const keywords = jobKeywords(query);

  const visible = {
    companyId: scope.companyId,
    ...candidateVisibilityFilter(scope.session.user),
  };
  const insensitive = "insensitive" as const;

  // По каждому слову — кто подходит. Запросы идут одновременно.
  const hits = await Promise.all(
    keywords.map((word) =>
      db.candidate
        .findMany({
          where: {
            ...visible,
            OR: [
              { currentPosition: { contains: word, mode: insensitive } },
              { skills: { hasSome: caseVariants(word) } },
              { experience: { some: { position: { contains: word, mode: insensitive } } } },
              { resumes: { some: { parsedText: { contains: word, mode: insensitive } } } },
            ],
          },
          select: { id: true },
          take: 400,
        })
        .then((rows) => rows.map((row) => row.id)),
    ),
  );

  const ranked = rankMatches(hits).slice(0, MAX_RESULTS);
  const scoreOf = new Map(ranked.map((item) => [item.id, item.score]));

  const candidates = ranked.length
    ? await db.candidate.findMany({
        where: { ...visible, id: { in: ranked.map((item) => item.id) } },
        select: {
          id: true,
          fullName: true,
          currentPosition: true,
          city: true,
          photoKey: true,
          jobId: true,
          rejectionReason: true,
          updatedAt: true,
          job: { select: { title: true } },
          stage: { select: { name: true, key: true } },
          _count: { select: { feedbacks: true } },
        },
      })
    : [];

  candidates.sort((a, b) => (scoreOf.get(b.id) ?? 0) - (scoreOf.get(a.id) ?? 0));

  return (
    <div>
      <BackButton fallbackHref={`/jobs/${job.id}`} fallbackLabel="К вакансии" />

      <h1 className="mt-3 text-xl font-semibold text-ink-strong">Подбор из базы</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Вакансия «{job.title}». Здесь люди, которых уже рассматривали, — с резюме
        и отзывами. Добавленный встаёт на первый этап, прошлые отзывы остаются
        в его карточке.
      </p>

      <form className="mt-5 rounded-xl border border-line bg-surface p-4">
        <label htmlFor="pick-q" className="block text-sm font-medium text-ink">
          Описание вакансии или ключевые слова
        </label>
        <textarea
          id="pick-q"
          name="q"
          rows={3}
          defaultValue={query}
          placeholder="Аналитик данных, SQL, Power BI"
          className={inputClass(false, "mt-1.5")}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="submit" className={buttonClass({ variant: "primary" })}>
            <Search className="size-4" strokeWidth={1.8} aria-hidden />
            Найти
          </button>
          {keywords.length > 0 && (
            <p className="text-xs text-ink-soft">
              Ищем по словам:{" "}
              {keywords.map((word) => (
                <span
                  key={word}
                  className="mr-1 inline-block rounded bg-muted px-1.5 py-0.5 text-ink"
                >
                  {word}
                </span>
              ))}
            </p>
          )}
        </div>
      </form>

      {keywords.length === 0 ? (
        <p className="mt-5 text-sm text-ink-soft">
          Напишите, кого ищете: должность, навыки, инструменты.
        </p>
      ) : candidates.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-soft">
          В базе никого не нашлось. Попробуйте другие слова — например, только
          должность или главный навык.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {candidates.map((candidate) => {
            const score = scoreOf.get(candidate.id) ?? 0;
            const rejected = rejectionLabel(candidate.rejectionReason);
            // Уже в работе на этой вакансии — добавлять заново незачем.
            // Если на ней же получил отказ — можно вернуть.
            const activeHere =
              candidate.jobId === job.id &&
              candidate.stage.key !== "WE_DECLINED" &&
              candidate.stage.key !== "CANDIDATE_DECLINED" &&
              candidate.stage.key !== "REJECTED";
            return (
              <li
                key={candidate.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-nowrap"
              >
                <Avatar
                  name={candidate.fullName}
                  candidateId={candidate.id}
                  hasPhoto={Boolean(candidate.photoKey)}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="text-sm font-semibold text-ink-strong hover:underline"
                  >
                    {candidate.fullName}
                  </Link>
                  <p className="truncate text-sm text-ink-soft">
                    {candidate.currentPosition ?? "должность не указана"}
                    {candidate.city ? ` · ${candidate.city}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {candidate.job ? `Вакансия: «${candidate.job.title}»` : "Без вакансии"} ·{" "}
                    {candidate.stage.name}
                    {rejected ? ` (${rejected.toLowerCase()})` : ""}
                    {candidate._count.feedbacks > 0
                      ? ` · отзывов: ${candidate._count.feedbacks}`
                      : ""}{" "}
                    · обновлён {formatDate(candidate.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className="text-xs text-ink-soft tabular-nums"
                    title="Сколько слов из описания нашлось у кандидата"
                  >
                    совпало {score} из {keywords.length}
                  </span>
                  <AssignToJobButton
                    candidateId={candidate.id}
                    jobId={job.id}
                    already={activeHere}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
