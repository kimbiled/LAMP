import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getScope, assertOwnCompany } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { Avatar } from "@/components/avatar";
import { StageBadge } from "@/components/stage-badge";
import { formatDateTime, formatMoney } from "@/lib/format";
import { HISTORY_LABELS } from "@/lib/labels";
import { ContactButtons } from "./contact-buttons";
import { StageSelect } from "./stage-select";
import { DeleteCandidateButton } from "./delete-button";

export const metadata: Metadata = { title: "Кандидат — LAMP" };

export default async function CandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await getScope();

  const candidate = await db.candidate.findFirst({
    where: {
      id,
      companyId: scope.companyId,
      ...candidateVisibilityFilter(scope.session.user),
    },
    include: {
      job: { select: { id: true, title: true } },
      stage: { select: { id: true, name: true, key: true } },
      createdBy: { select: { fullName: true } },
      history: {
        orderBy: { createdAt: "desc" },
        include: {
          fromStage: { select: { name: true } },
          toStage: { select: { name: true } },
        },
      },
    },
  });

  assertOwnCompany(candidate, scope.companyId);
  if (!candidate) return null;

  const stages = await db.stage.findMany({
    where: { companyId: scope.companyId },
    select: { id: true, name: true },
    orderBy: { position: "asc" },
  });

  const canEdit = scope.can("candidates.edit");
  const canMove = scope.can("candidates.move");

  const facts = [
    { label: "Город", value: candidate.city },
    { label: "Должность", value: candidate.currentPosition },
    {
      label: "Опыт",
      value:
        candidate.experienceYears !== null
          ? `${candidate.experienceYears} лет`
          : null,
    },
    {
      label: "Ожидания",
      value:
        candidate.salaryExpectation !== null
          ? formatMoney(candidate.salaryExpectation, candidate.currency)
          : null,
    },
    { label: "Источник", value: candidate.source },
    { label: "Добавил", value: candidate.createdBy.fullName },
  ].filter((fact) => fact.value);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/candidates"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />К списку кандидатов
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={candidate.fullName} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-ink-strong">
                {candidate.fullName}
              </h1>
              <StageBadge
                name={candidate.stage.name}
                stageKey={candidate.stage.key}
              />
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {candidate.job ? (
                <Link
                  href={`/jobs/${candidate.job.id}`}
                  className="underline transition hover:text-ink"
                >
                  {candidate.job.title}
                </Link>
              ) : (
                "Вакансия не назначена"
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canMove && (
            <StageSelect
              candidateId={candidate.id}
              stageId={candidate.stage.id}
              stages={stages}
            />
          )}
          {canEdit && (
            <Link
              href={`/candidates/${candidate.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-muted px-3 py-2 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.8} />
              Изменить
            </Link>
          )}
          {scope.can("candidates.delete") && (
            <DeleteCandidateButton
              candidateId={candidate.id}
              candidateName={candidate.fullName}
            />
          )}
        </div>
      </div>

      <div className="mt-5">
        <ContactButtons
          candidateName={candidate.fullName}
          phone={candidate.phone}
          email={candidate.email}
          telegram={candidate.telegram}
          recruiterName={scope.session.user.fullName}
          companyName={scope.session.company.name}
          jobTitle={candidate.job?.title}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-muted bg-surface p-5">
            <h2 className="text-sm font-medium text-ink">Информация</h2>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {candidate.phone && (
                <div>
                  <dt className="text-xs text-ink-soft">Телефон</dt>
                  <dd className="text-sm text-ink">{candidate.phone}</dd>
                </div>
              )}
              {candidate.email && (
                <div className="min-w-0">
                  <dt className="text-xs text-ink-soft">Email</dt>
                  <dd className="truncate text-sm text-ink">
                    {candidate.email}
                  </dd>
                </div>
              )}
              {candidate.telegram && (
                <div>
                  <dt className="text-xs text-ink-soft">Telegram</dt>
                  <dd className="text-sm text-ink">@{candidate.telegram}</dd>
                </div>
              )}
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs text-ink-soft">{fact.label}</dt>
                  <dd className="text-sm text-ink">{fact.value}</dd>
                </div>
              ))}
            </dl>

            {candidate.skills.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-ink-soft">Навыки</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {candidate.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md bg-muted px-2 py-0.5 text-xs text-ink"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {candidate.languages.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-ink-soft">Языки</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {candidate.languages.map((language) => (
                    <span
                      key={language}
                      className="rounded-md bg-muted px-2 py-0.5 text-xs text-ink"
                    >
                      {language}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {candidate.note && (
              <div className="mt-4 border-t border-muted pt-3">
                <p className="text-xs text-ink-soft">Комментарий</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                  {candidate.note}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-dashed border-muted bg-surface p-8 text-center">
            <p className="text-sm text-ink-soft">
              Резюме, интервью, фидбэки и кнопка «Поделиться» появятся на
              следующих этапах.
            </p>
          </section>
        </div>

        <section className="rounded-xl border border-muted bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">История</h2>

          <ol className="mt-3 space-y-3">
            {candidate.history.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    {HISTORY_LABELS[item.type]}
                    {item.type === "STAGE_CHANGED" && item.toStage && (
                      <span className="text-ink-soft">
                        {": "}
                        {item.fromStage?.name ?? "—"} → {item.toStage.name}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {formatDateTime(item.createdAt)}
                    {item.actorName ? ` · ${item.actorName}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
