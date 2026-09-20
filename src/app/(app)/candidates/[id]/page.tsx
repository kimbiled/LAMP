import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getScope, assertOwnCompany } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { Avatar } from "@/components/avatar";
import { StageBadge } from "@/components/stage-badge";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import {
  FEEDBACK_RESULT_LABELS,
  HISTORY_LABELS,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPE_LABELS,
} from "@/lib/labels";
import { todayLocal } from "@/lib/time";
import { ContactButtons } from "./contact-buttons";
import { ResumeSection } from "./resume-section";
import { StagePipeline } from "@/components/stage-pipeline";
import { InterviewsBlock } from "./interviews-block";
import { FeedbackBlock } from "./feedback-block";
import { ShareBlock } from "./share-block";
import { DeleteCandidateButton } from "./delete-button";

export const metadata: Metadata = { title: "Кандидат — LAMP" };

export default async function CandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await getScope();

  // Три независимых запроса запускаем одновременно, а не по очереди.
  const [candidate, stages, users] = await Promise.all([
    db.candidate.findFirst({
    where: {
      id,
      companyId: scope.companyId,
      ...candidateVisibilityFilter(scope.session.user),
    },
    include: {
      job: { select: { id: true, title: true } },
      stage: { select: { id: true, name: true, key: true } },
      createdBy: { select: { fullName: true } },
      experience: { orderBy: { sortOrder: "asc" } },
      education: { orderBy: { sortOrder: "asc" } },
      resumes: {
        orderBy: { uploadedAt: "desc" },
        include: { uploadedBy: { select: { fullName: true } } },
      },
      interviews: {
        orderBy: { scheduledAt: "desc" },
        include: { interviewer: { select: { fullName: true } } },
      },
      feedbacks: {
        orderBy: { createdAt: "desc" },
        include: {
          stage: { select: { name: true } },
          author: { select: { fullName: true } },
        },
      },
      shareLinks: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { fullName: true } },
          _count: { select: { feedbacks: true } },
        },
      },
        history: {
          orderBy: { createdAt: "desc" },
          include: {
            fromStage: { select: { name: true } },
            toStage: { select: { name: true } },
          },
        },
      },
    }),
    db.stage.findMany({
      where: { companyId: scope.companyId },
      select: { id: true, name: true, key: true, position: true },
      orderBy: { position: "asc" },
    }),
    scope.can("interviews.manage")
      ? db.user.findMany({
          where: { companyId: scope.companyId, isActive: true },
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([]),
  ]);

  assertOwnCompany(candidate, scope.companyId);
  if (!candidate) return null;

  const canEdit = scope.can("candidates.edit");
  const canMove = scope.can("candidates.move");
  const canManageInterviews = scope.can("interviews.manage");

  // Готовим данные для блоков заранее: даты форматируем на сервере,
  // чтобы в браузере не было расхождений часовых поясов.
  const interviewViews = candidate.interviews.map((interview) => ({
    id: interview.id,
    typeLabel: INTERVIEW_TYPE_LABELS[interview.type],
    statusLabel: INTERVIEW_STATUS_LABELS[interview.status],
    status: interview.status,
    whenText: formatDateTime(interview.scheduledAt),
    durationText: interview.durationMinutes
      ? `${interview.durationMinutes} мин`
      : null,
    interviewerName: interview.interviewer?.fullName ?? null,
    comment: interview.comment,
  }));

  const feedbackViews = candidate.feedbacks.map((feedback) => ({
    id: feedback.id,
    authorName: feedback.author?.fullName ?? feedback.authorName ?? "Гость",
    whenText: formatDateTime(feedback.createdAt),
    stageName: feedback.stage?.name ?? null,
    result: feedback.result,
    resultLabel: FEEDBACK_RESULT_LABELS[feedback.result],
    comment: feedback.comment,
  }));

  const shareLinkViews = candidate.shareLinks.map((link) => ({
    id: link.id,
    token: link.token,
    createdByName: link.createdBy.fullName,
    createdText: formatDate(link.createdAt),
    expiresText: link.expiresAt ? formatDate(link.expiresAt) : null,
    isExpired: Boolean(
      link.revokedAt || (link.expiresAt && link.expiresAt < new Date()),
    ),
    viewCount: link.viewCount,
    feedbackCount: link._count.feedbacks,
  }));

  const interviewOptions = candidate.interviews.map((interview) => ({
    id: interview.id,
    label: `${INTERVIEW_TYPE_LABELS[interview.type]} · ${formatDateTime(interview.scheduledAt)}`,
  }));

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
        <StagePipeline
          candidateId={candidate.id}
          currentStageId={candidate.stage.id}
          stages={stages}
          canMove={canMove}
        />
      </div>

      <div className="mt-4">
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
                  <dd className="text-sm break-words text-ink">{candidate.phone}</dd>
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
                  <dd className="text-sm break-words text-ink">@{candidate.telegram}</dd>
                </div>
              )}
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs text-ink-soft">{fact.label}</dt>
                  <dd className="text-sm break-words text-ink">{fact.value}</dd>
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

          {candidate.experience.length > 0 && (
            <section className="rounded-xl border border-muted bg-surface p-5">
              <h2 className="text-sm font-medium text-ink">Опыт работы</h2>
              <ul className="mt-3 space-y-4">
                {candidate.experience.map((item) => (
                  <li key={item.id} className="border-l-2 border-accent/50 pl-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-sm font-medium text-ink">
                        {item.position ?? "Должность не указана"}
                      </p>
                      {item.period && (
                        <p className="text-xs text-ink-soft">{item.period}</p>
                      )}
                    </div>
                    <p className="text-sm text-ink-soft">{item.companyName}</p>
                    {item.description && (
                      <p className="mt-1.5 text-sm whitespace-pre-line text-ink">
                        {item.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {candidate.education.length > 0 && (
            <section className="rounded-xl border border-muted bg-surface p-5">
              <h2 className="text-sm font-medium text-ink">Образование</h2>
              <ul className="mt-3 space-y-3">
                {candidate.education.map((item) => (
                  <li key={item.id} className="border-l-2 border-muted pl-3">
                    <p className="text-sm font-medium text-ink">
                      {item.institution}
                    </p>
                    {item.specialty && (
                      <p className="text-sm text-ink-soft">{item.specialty}</p>
                    )}
                    {item.years && (
                      <p className="text-xs text-ink-soft">{item.years}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ResumeSection
            candidateId={candidate.id}
            resumes={candidate.resumes}
            canUpload={canEdit}
          />

          <InterviewsBlock
            candidateId={candidate.id}
            interviews={interviewViews}
            users={users}
            canManage={canManageInterviews}
            defaultDate={todayLocal()}
            defaultInterviewerId={scope.session.user.id}
          />

          <FeedbackBlock
            candidateId={candidate.id}
            feedbacks={feedbackViews}
            stages={stages}
            interviews={interviewOptions}
            currentStageId={candidate.stage.id}
            canCreate={scope.can("feedback.create")}
          />

          <ShareBlock
            candidateId={candidate.id}
            links={shareLinkViews}
            canShare={scope.can("share.create")}
          />
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
                  {item.comment && (
                    <p className="mt-0.5 text-sm text-ink-soft italic">
                      «{item.comment}»
                    </p>
                  )}
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
