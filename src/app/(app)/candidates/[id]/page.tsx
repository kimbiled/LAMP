import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronDown,
  ExternalLink,
  FileDown,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { BackButton } from "@/components/back-button";
import { db } from "@/lib/db";
import { getScope, assertOwnCompany } from "@/lib/tenant";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { Avatar } from "@/components/avatar";
import { StageBadge } from "@/components/stage-badge";
import { ChannelBadge } from "@/components/channel-badge";
import {
  formatBirth,
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/lib/format";
import {
  FEEDBACK_RESULT_LABELS,
  HISTORY_LABELS,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPE_LABELS,
  ROLE_LABELS,
} from "@/lib/labels";
import { todayLocal } from "@/lib/time";
import { minutesToTime, placeInDay } from "@/lib/calendar";
import { joinUrl } from "@/lib/meeting";
import { telLink } from "@/lib/contacts";
import { publicBaseUrl } from "@/lib/app-url";
import { TONE_STYLES, stageTone } from "@/lib/stages";
import { rejectionLabel, rejectionSide } from "@/lib/rejection";
import { reparseResume } from "@/app/actions/resumes";
import { ContactButtons } from "./contact-buttons";
import { ResumeSection } from "./resume-section";
import { StagePipeline } from "@/components/stage-pipeline";
import { InterviewsBlock } from "./interviews-block";
import { FeedbackBlock } from "./feedback-block";
import { ShareBlock } from "./share-block";
import { TagsBlock } from "./tags-block";
import { DeleteCandidateButton } from "./delete-button";
import { buttonClass } from "@/components/ui/styles";
import { ExperienceList } from "@/components/experience-list";

export const metadata: Metadata = { title: "Кандидат — LAMP" };

export default async function CandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await getScope();

  // Независимые запросы запускаем одновременно, а не по очереди.
  const [candidate, stages, users, company, companyTags] = await Promise.all([
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
            author: { select: { fullName: true, position: true, role: true } },
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
    // Постоянная ссылка на встречу компании — для кнопки в форме интервью.
    db.company.findUnique({
      where: { id: scope.companyId },
      select: { meetingLink: true },
    }),
    // Метки, уже заведённые в компании, — для подсказок в поле ввода.
    db.tag.findMany({
      where: { companyId: scope.companyId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  assertOwnCompany(candidate, scope.companyId);
  if (!candidate) return null;

  const canEdit = scope.can("candidates.edit");
  const canMove = scope.can("candidates.move");
  const canManageInterviews = scope.can("interviews.manage");

  // Готовим данные для блоков заранее: даты форматируем на сервере,
  // чтобы в браузере не было расхождений часовых поясов.
  const interviewViews = candidate.interviews.map((interview) => {
    // Для формы изменения нужны не подписи, а сами значения: дата и время
    // в часовом поясе компании, а не в том, что стоит у браузера.
    const placed = placeInDay(interview.scheduledAt);

    return {
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
      joinUrl: joinUrl(interview),
      meetingUrl: interview.meetingUrl ?? "",

      type: interview.type,
      date: placed.date,
      time: minutesToTime(placed.minutes),
      durationMinutes: String(interview.durationMinutes ?? 60),
      interviewerId: interview.interviewerId ?? "",
    };
  });

  const feedbackViews = candidate.feedbacks.map((feedback) => ({
    id: feedback.id,
    authorName: feedback.author?.fullName ?? feedback.authorName ?? "Гость",
    // Пока человек не заполнил должность в настройках, показываем роль —
    // это всё равно лучше, чем пустое место.
    authorPosition: feedback.author
      ? (feedback.author.position ?? ROLE_LABELS[feedback.author.role])
      : "гость по ссылке",
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

  const birthText = formatBirth(candidate.birthDate);
  const tone = TONE_STYLES[stageTone(candidate.stage.key)];

  // Главное для решения «звать или нет» — стаж и зарплатные ожидания.
  // Раньше они лежали внизу левой колонки, теперь — в шапке, рядом с именем.
  const keyFacts = [
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
    { label: "Email", value: candidate.email },
  ].filter((fact) => fact.value);

  // Остальное — в блоке «Информация».
  const facts = [
    // Пришедшие с hh несут ссылку на исходное резюме: оттуда видно,
    // что человек поменял у себя после того, как мы его завели.
    { label: "Источник", value: candidate.source, href: candidate.sourceUrl },
    { label: "Добавил", value: candidate.createdBy.fullName },
  ].filter((fact) => fact.value);

  return (
    <div>
      <BackButton
        fallbackHref="/candidates"
        fallbackLabel="К списку кандидатов"
      />

      {/* Шапка карточки: сначала человек, потом всё остальное. */}
      <section
        className={`mt-4 rounded-xl border p-5 ${tone.border} ${tone.card}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar
              name={candidate.fullName}
              size="lg"
              candidateId={candidate.id}
              hasPhoto={Boolean(candidate.photoKey)}
            />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-ink-strong">
                  {candidate.fullName}
                </h1>
                <StageBadge
                  name={candidate.stage.name}
                  stageKey={candidate.stage.key}
                />
                <ChannelBadge channel={candidate.sourceChannel} />
              </div>

              {birthText && (
                <p className="mt-1 text-sm text-ink-soft">{birthText}</p>
              )}

              {candidate.phone && (
                <p className="mt-2 text-lg font-medium text-ink">
                  <a
                    href={telLink(candidate.phone) ?? undefined}
                    className="transition hover:text-ink-strong"
                  >
                    {candidate.phone}
                  </a>
                </p>
              )}

              <p className="mt-2 text-base font-medium text-ink">
                {candidate.currentPosition ?? "Должность не указана"}
              </p>

              <p className="mt-0.5 text-sm text-ink-soft">
                {candidate.city ? `${candidate.city} · ` : ""}
                {candidate.job ? (
                  <Link
                    href={`/jobs/${candidate.job.id}`}
                    className="underline transition hover:text-ink"
                  >
                    {candidate.job.title}
                  </Link>
                ) : (
                  "вакансия не назначена"
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-2">
            {/* Выгрузка в PDF. Обычный details, как у «Истории»:
                работает без кода в браузере. Вариант без контактов —
                для заказчика, который не должен звонить кандидату сам. */}
            <details className="group relative">
              <summary
                className={`${buttonClass({ variant: "secondary" })} cursor-pointer list-none`}
              >
                <FileDown className="h-4 w-4" strokeWidth={1.8} />
                Скачать PDF
                <ChevronDown
                  className="h-4 w-4 transition group-open:rotate-180"
                  strokeWidth={1.8}
                />
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg">
                <a
                  href={`/api/candidates/${candidate.id}/pdf`}
                  className="block px-3 py-2 text-sm text-ink transition hover:bg-canvas"
                >
                  С контактами
                </a>
                <a
                  href={`/api/candidates/${candidate.id}/pdf?contacts=0`}
                  className="block px-3 py-2 text-sm text-ink transition hover:bg-canvas"
                >
                  Без контактов
                  <span className="block text-xs text-ink-soft">
                    без телефона, почты и Telegram
                  </span>
                </a>
              </div>
            </details>

            {canEdit && (
              <Link
                href={`/candidates/${candidate.id}/edit`}
                className={buttonClass({ variant: "secondary" })}
              >
                <Pencil className="h-4 w-4" strokeWidth={1.8} />
                Изменить
              </Link>
            )}
          </div>
        </div>

        {keyFacts.length > 0 && (
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-4">
            {keyFacts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-xs text-ink-soft">{fact.label}</dt>
                <dd className="truncate text-base font-medium text-ink">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <TagsBlock
          candidateId={candidate.id}
          tags={candidate.tags}
          allTags={companyTags.map((tag) => tag.name)}
          canEdit={canEdit}
        />

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
      </section>

      <div className="mt-4">
        <StagePipeline
          candidateId={candidate.id}
          currentStageId={candidate.stage.id}
          stages={stages}
          canMove={canMove}
        />

        {/* Причина отказа сразу под этапом: именно её ищут,
            когда открывают карточку отказанного кандидата. */}
        {rejectionSide(candidate.stage.key) &&
          (candidate.rejectionReason || candidate.rejectionComment) && (
            <div className="mt-2 rounded-xl border border-line bg-surface px-4 py-3">
              <p className="text-xs text-ink-soft">Причина</p>
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
      </div>

      {/* Две колонки от 1024 пикселей: слева то, что о человеке известно
          (встречи, опыт, резюме), справа то, что о нём думают (отзывы,
          ссылка для коллег, история). Уже — один столбец, и порядок
          разметки становится обычным: интервью, отзывы, остальное.

          grid-cols-1 на телефоне обязателен: без него столбец
          растягивается по самому широкому элементу внутри, и страница
          становится шире экрана. */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] lg:grid-rows-[auto_1fr] lg:items-start">
        <div className="lg:col-start-1 lg:row-start-1">
          <InterviewsBlock
            candidateId={candidate.id}
            interviews={interviewViews}
            users={users}
            canManage={canManageInterviews}
            defaultDate={todayLocal()}
            defaultInterviewerId={scope.session.user.id}
            meetingLink={company?.meetingLink ?? null}
          />
        </div>

        {/* Колонка идёт вместе со страницей, без своей прокрутки.
            Раньше у неё была отдельная полоса прокрутки, и список
            отзывов выглядел обрезанным посередине карточки. */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="space-y-5">
            <FeedbackBlock
              candidateId={candidate.id}
              feedbacks={feedbackViews}
              currentStageId={candidate.stage.id}
              canCreate={scope.can("feedback.create")}
              canManage={scope.can("feedback.manage")}
            />

            {/* «Поделиться» — рядом с мнениями: ссылку отправляют
                именно затем, чтобы собрать ещё одно мнение. */}
            <ShareBlock
              candidateId={candidate.id}
              links={shareLinkViews}
              canShare={scope.can("share.create")}
              baseUrl={publicBaseUrl()}
            />

            {/* История свёрнута: это длинная лента, которая нужна редко —
                разобраться, кто и когда двигал человека. Открытой она
                отжимала вниз всё остальное.

                Обычный details, а не своя кнопка с состоянием: страница
                серверная, и так разворачивание работает даже до того,
                как загрузится код страницы. */}
            <details className="group rounded-xl border border-line bg-warm p-5 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <span className="text-base font-semibold text-ink-strong">
                  История
                  <span className="ml-1.5 text-ink-soft">
                    {candidate.history.length}
                  </span>
                </span>

                <span className="flex items-center gap-1 text-xs text-ink-soft">
                  <span className="group-open:hidden">Показать</span>
                  <span className="hidden group-open:inline">Свернуть</span>
                  <ChevronDown
                    className="h-4 w-4 transition group-open:rotate-180"
                    strokeWidth={1.8}
                  />
                </span>
              </summary>

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
            </details>
          </div>
        </div>

        <div className="space-y-5 lg:col-start-1 lg:row-start-2">
          {candidate.experience.length === 0 &&
            candidate.resumes.length > 0 && (
              <section className="rounded-xl border border-dashed border-line bg-surface p-5">
                <h2 className="text-base font-semibold text-ink-strong">
                  Опыт работы
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Не распознан. Резюме загружено — можно прочитать его ещё раз
                  или заполнить опыт вручную через «Изменить».
                </p>
                {canEdit && (
                  <form action={reparseResume} className="mt-3">
                    <input
                      type="hidden"
                      name="candidateId"
                      value={candidate.id}
                    />
                    <button
                      type="submit"
                      className={buttonClass({ variant: "primary" })}
                    >
                      <RefreshCw className="h-4 w-4" strokeWidth={2} />
                      Распознать из резюме
                    </button>
                  </form>
                )}
              </section>
            )}

          {candidate.experience.length > 0 && (
            <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <h2 className="text-base font-semibold text-ink-strong">
                Опыт работы
              </h2>
              <div className="mt-4">
                <ExperienceList items={candidate.experience} />
              </div>
            </section>
          )}

          {candidate.education.length > 0 && (
            <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <h2 className="text-base font-semibold text-ink-strong">
                Образование
              </h2>
              <ul className="mt-3 space-y-3">
                {candidate.education.map((item) => (
                  <li key={item.id} className="border-l-2 border-line pl-3">
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

          <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink-strong">
              Информация
            </h2>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {candidate.telegram && (
                <div>
                  <dt className="text-xs text-ink-soft">Telegram</dt>
                  <dd className="text-sm break-words text-ink">
                    @{candidate.telegram}
                  </dd>
                </div>
              )}
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs text-ink-soft">{fact.label}</dt>
                  <dd className="text-sm break-words text-ink">
                    {"href" in fact && fact.href ? (
                      <a
                        href={fact.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline decoration-accent underline-offset-2 transition hover:decoration-2"
                      >
                        {fact.value}
                        <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
                      </a>
                    ) : (
                      fact.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            {candidate.skills.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-ink-soft">Навыки</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {candidate.skills.map((skill, index) => (
                    <span
                      key={`${skill}-${index}`}
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
                  {candidate.languages.map((language, index) => (
                    <span
                      key={`${language}-${index}`}
                      className="rounded-md bg-muted px-2 py-0.5 text-xs text-ink"
                    >
                      {language}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {candidate.note && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-xs text-ink-soft">Комментарий</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                  {candidate.note}
                </p>
              </div>
            )}
          </section>

          <ResumeSection
            candidateId={candidate.id}
            resumes={candidate.resumes}
            canUpload={canEdit}
          />

        </div>
      </div>

      {/* Удаление — отдельно, в самом низу. Раньше кнопка стояла вплотную
          к «Изменить» и выглядела так же: промахнуться было легко. */}
      {scope.can("candidates.delete") && (
        <div className="mt-10 flex justify-end border-t border-line pt-5">
          <DeleteCandidateButton
            candidateId={candidate.id}
            candidateName={candidate.fullName}
          />
        </div>
      )}
    </div>
  );
}
