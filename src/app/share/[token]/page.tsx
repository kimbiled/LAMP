import type { Metadata } from "next";
import { Download, ExternalLink, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { findValidShareLink } from "@/lib/share";
import { Avatar } from "@/components/avatar";
import { StageBadge } from "@/components/stage-badge";
import { formatBytes, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { FEEDBACK_RESULT_LABELS, HISTORY_LABELS } from "@/lib/labels";
import { GuestFeedbackForm } from "./guest-feedback-form";

// Публичная страница кандидата по ссылке «Поделиться».
// Вход в систему не нужен, но и доступа к остальной системе нет:
// видно ровно одного кандидата и ничего больше.

export const metadata: Metadata = {
  title: "Кандидат — LAMP",
  // Страницу не должны находить поисковики.
  robots: { index: false, follow: false },
};

const RESULT_STYLES: Record<string, string> = {
  POSITIVE: "bg-green-100 text-green-800",
  NEGATIVE: "bg-red-50 text-red-700",
  EXTRA_STAGE: "bg-accent/25 text-ink",
};

function Invalid({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-xl font-semibold text-ink">
        L
      </span>
      <h1 className="mt-6 text-xl font-semibold text-ink-strong">
        Ссылка недоступна
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">{reason}</p>
    </div>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await findValidShareLink(token);

  if (!link) {
    return (
      <Invalid reason="Срок действия ссылки истёк или её отозвали. Попросите новую у рекрутера." />
    );
  }

  const candidate = await db.candidate.findUnique({
    where: { id: link.candidateId },
    include: {
      job: { select: { title: true } },
      stage: { select: { name: true, key: true } },
      experience: { orderBy: { sortOrder: "asc" } },
      education: { orderBy: { sortOrder: "asc" } },
      resumes: {
        where: { isCurrent: true },
        orderBy: { uploadedAt: "desc" },
        take: 1,
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
      company: { select: { name: true } },
    },
  });

  if (!candidate) {
    return <Invalid reason="Кандидат был удалён." />;
  }

  // Считаем просмотры, чтобы рекрутер видел, открывали ли ссылку.
  await db.shareLink.update({
    where: { id: link.id },
    data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  });

  const resume = candidate.resumes[0];

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
  ].filter((fact) => fact.value);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-ink">
          L
        </span>
        <p className="text-sm text-ink-soft">
          {candidate.company.name} · карточка кандидата
        </p>
      </div>

      <div className="mt-6 flex items-center gap-3">
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
            {candidate.job?.title ?? "Вакансия не назначена"}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <section className="rounded-xl border border-muted bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">Информация</h2>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
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

          <p className="mt-4 border-t border-muted pt-3 text-xs text-ink-soft">
            Контакты кандидата по ссылке не показываются. Если нужно связаться —
            напишите рекрутеру.
          </p>
        </section>

        {candidate.experience.length > 0 && (
          <section className="rounded-xl border border-muted bg-surface p-5">
            <h2 className="text-sm font-medium text-ink">Опыт работы</h2>
            <ul className="mt-3 space-y-3">
              {candidate.experience.map((item) => (
                <li key={item.id} className="border-l-2 border-muted pl-3">
                  <p className="text-sm font-medium text-ink">
                    {item.companyName}
                  </p>
                  {item.position && (
                    <p className="text-sm text-ink-soft">{item.position}</p>
                  )}
                  {item.period && (
                    <p className="text-xs text-ink-soft">{item.period}</p>
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

        <section className="rounded-xl border border-muted bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">Резюме</h2>

          {resume ? (
            <div className="mt-3 rounded-lg border border-muted bg-canvas p-3">
              <div className="flex items-start gap-3">
                <FileText
                  className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft"
                  strokeWidth={1.8}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{resume.fileName}</p>
                  <p className="text-xs text-ink-soft">
                    {formatBytes(resume.sizeBytes)} ·{" "}
                    {formatDate(resume.uploadedAt)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/api/share/${token}/resume/${resume.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-muted bg-surface px-3 py-1.5 text-sm text-ink transition hover:border-ink-soft"
                >
                  <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                  Открыть
                </a>
                <a
                  href={`/api/share/${token}/resume/${resume.id}?download`}
                  className="inline-flex items-center gap-2 rounded-lg border border-muted bg-surface px-3 py-1.5 text-sm text-ink transition hover:border-ink-soft"
                >
                  <Download className="h-4 w-4" strokeWidth={1.8} />
                  Скачать
                </a>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Резюме не загружено.</p>
          )}
        </section>

        <section className="rounded-xl border border-muted bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">Оставить фидбэк</h2>
          <p className="mt-1 mb-4 text-xs text-ink-soft">
            Ваше мнение появится в карточке кандидата у рекрутера.
          </p>
          <GuestFeedbackForm token={token} />
        </section>

        {candidate.feedbacks.length > 0 && (
          <section className="rounded-xl border border-muted bg-surface p-5">
            <h2 className="text-sm font-medium text-ink">Фидбэки</h2>
            <ul className="mt-3 space-y-3">
              {candidate.feedbacks.map((feedback) => (
                <li
                  key={feedback.id}
                  className="rounded-lg border border-muted bg-canvas p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">
                      {feedback.author?.fullName ??
                        feedback.authorName ??
                        "Гость"}
                    </p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs ${RESULT_STYLES[feedback.result]}`}
                    >
                      {FEEDBACK_RESULT_LABELS[feedback.result]}
                    </span>
                  </div>
                  <p className="text-xs text-ink-soft">
                    {formatDateTime(feedback.createdAt)}
                    {feedback.stage ? ` · ${feedback.stage.name}` : ""}
                  </p>
                  {feedback.comment && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                      {feedback.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

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

      <p className="mt-8 text-center text-xs text-ink-soft">
        LAMP · система подбора персонала
      </p>
    </div>
  );
}
