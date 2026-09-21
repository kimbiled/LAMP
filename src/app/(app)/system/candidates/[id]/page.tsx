import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/superadmin";
import { logAction } from "@/lib/audit";
import { Avatar } from "@/components/avatar";
import { StageBadge } from "@/components/stage-badge";
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/lib/format";
import {
  FEEDBACK_RESULT_LABELS,
  HISTORY_LABELS,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPE_LABELS,
} from "@/lib/labels";
import { TONE_STYLES, stageTone } from "@/lib/stages";
import { rejectionLabel, rejectionSide } from "@/lib/rejection";

export const metadata: Metadata = { title: "Кандидат — LAMP" };

// Карточка кандидата глазами владельца системы: всё, что есть в базе,
// включая компанию, вакансию, резюме, интервью, фидбэки и историю.
//
// Только чтение. Менять данные компании отсюда нельзя — иначе в истории
// появились бы правки от человека, которого в этой компании нет.

export default async function SystemCandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireOwner();

  const candidate = await db.candidate.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      job: {
        select: {
          id: true,
          title: true,
          status: true,
          recruiter: { select: { fullName: true } },
          hiringManager: { select: { fullName: true } },
        },
      },
      stage: { select: { name: true, key: true } },
      createdBy: { select: { fullName: true } },
      tags: { select: { id: true, name: true }, orderBy: { name: "asc" } },
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
      history: {
        orderBy: { createdAt: "desc" },
        include: {
          fromStage: { select: { name: true } },
          toStage: { select: { name: true } },
        },
      },
    },
  });

  if (!candidate) {
    notFound();
  }

  // Заглядывание в чужую компанию отмечаем в журнале: потом будет видно,
  // кто и когда смотрел данные клиента.
  if (candidate.companyId !== session.user.companyId) {
    await logAction({
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "OWNER_VIEWED_CANDIDATE",
      entityType: "Candidate",
      entityId: candidate.id,
      meta: { company: candidate.company.name },
    });
  }

  const tone = TONE_STYLES[stageTone(candidate.stage.key)];
  const side = rejectionSide(candidate.stage.key);

  return (
    <div className="mx-auto max-w-4xl">
      <BackButton fallbackHref="/system/candidates" fallbackLabel="К базе кандидатов" />

      <section
        className={`mt-4 rounded-xl border p-5 ${tone.border} ${tone.card}`}
      >
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={candidate.fullName} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-ink-strong">
                {candidate.fullName}
              </h1>
              <StageBadge
                name={candidate.stage.name}
                stageKey={candidate.stage.key}
              />
            </div>

            {candidate.phone && (
              <p className="mt-1 text-lg text-ink">{candidate.phone}</p>
            )}

            <p className="mt-1 text-sm text-ink">
              {candidate.currentPosition ?? "Должность не указана"}
            </p>

            <p className="mt-1 text-sm text-ink-soft">
              <Link
                href={`/system/${candidate.company.id}`}
                className="underline transition hover:text-ink"
              >
                {candidate.company.name}
              </Link>
              {candidate.city ? ` · ${candidate.city}` : ""}
              {candidate.job ? ` · ${candidate.job.title}` : " · без вакансии"}
            </p>

            {candidate.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {candidate.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs text-ink"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {side && (candidate.rejectionReason || candidate.rejectionComment) && (
        <div className="mt-3 rounded-xl border border-muted bg-surface px-4 py-3">
          <p className="text-xs text-ink-soft">Причина отказа</p>
          <p className="mt-0.5 text-sm text-ink">
            {rejectionLabel(candidate.rejectionReason) ?? "не указана"}
          </p>
          {candidate.rejectionComment && (
            <p className="mt-1 text-sm text-ink-soft">
              {candidate.rejectionComment}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          {candidate.experience.length > 0 && (
            <section className="rounded-xl border border-muted bg-surface p-5">
              <h2 className="text-sm font-medium text-ink">Опыт работы</h2>
              <ul className="mt-3 space-y-4">
                {candidate.experience.map((item) => (
                  <li key={item.id} className="border-l-2 border-muted pl-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-ink">
                        {item.position ?? "Должность не указана"}
                      </p>
                      {item.period && (
                        <p className="text-xs text-ink-soft">{item.period}</p>
                      )}
                    </div>
                    <p className="text-sm text-ink-soft">{item.companyName}</p>
                    {item.description && (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">
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
                    <p className="text-sm text-ink">{item.institution}</p>
                    {item.specialty && (
                      <p className="text-xs text-ink-soft">{item.specialty}</p>
                    )}
                    {item.years && (
                      <p className="text-xs text-ink-soft">{item.years}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-muted bg-surface p-5">
            <h2 className="text-sm font-medium text-ink">Информация</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Field label="Email" value={candidate.email} />
              <Field label="Telegram" value={candidate.telegram} />
              <Field
                label="Опыт"
                value={
                  candidate.experienceYears
                    ? `${candidate.experienceYears} лет`
                    : null
                }
              />
              <Field
                label="Ожидания"
                value={
                  candidate.salaryExpectation
                    ? formatMoney(
                        candidate.salaryExpectation,
                        candidate.currency,
                      )
                    : null
                }
              />
              <Field label="Источник" value={candidate.source} />
              <Field label="Добавил" value={candidate.createdBy.fullName} />
            </dl>

            {candidate.skills.length > 0 && (
              <div className="mt-3">
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

            {candidate.note && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">
                {candidate.note}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-muted bg-surface p-5">
            <h2 className="text-sm font-medium text-ink">
              Резюме · {candidate.resumes.length}
            </h2>

            {candidate.resumes.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Файлов нет.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {candidate.resumes.map((resume) => (
                  <li
                    key={resume.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-muted bg-canvas p-3"
                  >
                    <FileText
                      className="h-4 w-4 shrink-0 text-ink-soft"
                      strokeWidth={1.8}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
                        {resume.fileName}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {formatBytes(resume.sizeBytes)} ·{" "}
                        {formatDate(resume.uploadedAt)} ·{" "}
                        {resume.uploadedBy.fullName}
                      </p>
                    </div>
                    <a
                      href={`/api/resumes/${resume.id}?download`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-muted bg-surface px-3 py-1.5 text-xs text-ink transition hover:border-ink-soft"
                    >
                      <Download className="h-3.5 w-3.5" strokeWidth={2} />
                      Скачать
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-muted bg-surface p-5">
            <h2 className="text-sm font-medium text-ink">
              Фидбэки · {candidate.feedbacks.length}
            </h2>

            {candidate.feedbacks.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Фидбэков нет.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {candidate.feedbacks.map((feedback) => (
                  <li
                    key={feedback.id}
                    className="rounded-lg border border-muted bg-canvas p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-ink">
                        {FEEDBACK_RESULT_LABELS[feedback.result]}
                      </span>
                      {feedback.stage && (
                        <span className="text-xs text-ink-soft">
                          {feedback.stage.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">
                      {feedback.comment}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {/* authorName заполняется, когда фидбэк оставили
                          по ссылке «Поделиться», без входа в систему. */}
                      {feedback.author?.fullName ??
                        feedback.authorName ??
                        "Гость по ссылке"}{" "}
                      · {formatDateTime(feedback.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          {candidate.job && (
            <section className="rounded-xl border border-muted bg-surface p-5">
              <h2 className="text-sm font-medium text-ink">Вакансия</h2>
              <p className="mt-2 text-sm text-ink">{candidate.job.title}</p>
              <p className="mt-1 text-xs text-ink-soft">
                Рекрутер: {candidate.job.recruiter?.fullName ?? "не назначен"}
              </p>
              <p className="text-xs text-ink-soft">
                Менеджер:{" "}
                {candidate.job.hiringManager?.fullName ?? "не назначен"}
              </p>
            </section>
          )}

          <section className="rounded-xl border border-muted bg-surface p-5">
            <h2 className="text-sm font-medium text-ink">
              Интервью · {candidate.interviews.length}
            </h2>

            {candidate.interviews.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Интервью не было.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {candidate.interviews.map((interview) => (
                  <li
                    key={interview.id}
                    className="rounded-lg border border-muted bg-canvas p-3"
                  >
                    <p className="text-sm text-ink">
                      {INTERVIEW_TYPE_LABELS[interview.type]}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {formatDateTime(interview.scheduledAt)} ·{" "}
                      {INTERVIEW_STATUS_LABELS[interview.status]}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {interview.interviewer?.fullName ??
                        "интервьюер не назначен"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

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
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="text-sm text-ink">{value ?? "—"}</dd>
    </div>
  );
}
