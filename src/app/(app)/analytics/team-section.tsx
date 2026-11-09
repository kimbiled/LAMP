import { Lightbulb } from "lucide-react";
import { db } from "@/lib/db";
import {
  cardCompleteness,
  daysBetweenDates,
  durationText,
  hoursBetweenDates,
  medianOrNull,
  teamRecommendations,
  type ManagerStats,
  type RecruiterStats,
} from "@/lib/team-analytics";

// Команда: скорость работы рекрутеров и нанимающих менеджеров.
// Видит только администратор — это оценка работы людей.
//
// Рекрутер:
//   • закрыто вакансий и за сколько дней (время найма);
//   • сколько дней от открытия вакансии до первого оффера;
//   • как быстро новый кандидат получает первое движение по этапам;
//   • сколько людей застряли на первом этапе дольше двух суток;
//   • насколько полно заполнены карточки, которые он завёл.
// Нанимающий менеджер:
//   • сколько встреч провёл, сколько отзывов оставил;
//   • через сколько после встречи приходит его отзыв;
//   • сколько прошедших встреч без отзыва.

export async function TeamSection({
  companyId,
  since,
  now,
}: {
  companyId: string;
  since: Date | null;
  now: Date;
}) {
  const period = since ? { gte: since } : undefined;
  const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000);

  const [users, jobs, offers, candidates, firstStage, interviews, feedbacks] =
    await Promise.all([
      db.user.findMany({
        where: { companyId, isActive: true },
        select: { id: true, fullName: true, role: true },
        orderBy: { fullName: "asc" },
      }),
      db.job.findMany({
        where: { companyId },
        select: {
          id: true,
          recruiterId: true,
          hiringManagerId: true,
          status: true,
          createdAt: true,
          closedAt: true,
          updatedAt: true,
        },
      }),
      // Первые переходы в оффер — для «дней до оффера» по вакансии.
      db.candidateHistory.findMany({
        where: {
          companyId,
          toStage: { key: { in: ["OFFER", "HIRED"] } },
          ...(period ? { createdAt: period } : {}),
        },
        select: { createdAt: true, candidate: { select: { jobId: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.candidate.findMany({
        where: { companyId, ...(period ? { createdAt: period } : {}) },
        select: {
          id: true,
          createdAt: true,
          createdById: true,
          phone: true,
          email: true,
          currentPosition: true,
          city: true,
          experienceYears: true,
          experienceMonths: true,
          skills: true,
          sourceChannel: true,
          stageId: true,
          job: { select: { recruiterId: true } },
          history: {
            where: { type: "STAGE_CHANGED" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
      db.stage.findFirst({
        where: { companyId },
        orderBy: { position: "asc" },
        select: { id: true },
      }),
      db.interview.findMany({
        where: {
          companyId,
          interviewerId: { not: null },
          status: { not: "CANCELED" },
          scheduledAt: { lt: now, ...(since ? { gte: since } : {}) },
        },
        select: {
          id: true,
          interviewerId: true,
          candidateId: true,
          scheduledAt: true,
          durationMinutes: true,
        },
      }),
      db.feedback.findMany({
        where: {
          companyId,
          authorId: { not: null },
          ...(period ? { createdAt: period } : {}),
        },
        select: { authorId: true, candidateId: true, interviewId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  // Первый оффер по каждой вакансии.
  const firstOffer = new Map<string, Date>();
  for (const offer of offers) {
    const jobId = offer.candidate.jobId;
    if (jobId && !firstOffer.has(jobId)) firstOffer.set(jobId, offer.createdAt);
  }

  // ---------- Рекрутеры ----------
  const recruiters: RecruiterStats[] = users
    .filter((user) => user.role === "ADMIN" || user.role === "RECRUITER")
    .map((user) => {
      const ownJobs = jobs.filter((job) => job.recruiterId === user.id);

      const closed = ownJobs.filter((job) => {
        if (job.status !== "CLOSED") return false;
        const closedOn = job.closedAt ?? job.updatedAt;
        return !since || closedOn >= since;
      });

      const mine = candidates.filter(
        (candidate) =>
          candidate.createdById === user.id || candidate.job?.recruiterId === user.id,
      );
      const added = candidates.filter((candidate) => candidate.createdById === user.id);

      const firstMoves = mine.flatMap((candidate) =>
        candidate.history[0]
          ? [hoursBetweenDates(candidate.createdAt, candidate.history[0].createdAt)]
          : [],
      );

      return {
        id: user.id,
        name: user.fullName,
        added: added.length,
        jobsClosed: closed.length,
        daysToClose: medianOrNull(
          closed.map((job) => daysBetweenDates(job.createdAt, job.closedAt ?? job.updatedAt)),
        ),
        daysToOffer: medianOrNull(
          ownJobs.flatMap((job) => {
            const offerAt = firstOffer.get(job.id);
            return offerAt ? [daysBetweenDates(job.createdAt, offerAt)] : [];
          }),
        ),
        hoursToFirstMove: medianOrNull(firstMoves),
        untouched: mine.filter(
          (candidate) =>
            candidate.stageId === firstStage?.id &&
            !candidate.history[0] &&
            candidate.createdAt < twoDaysAgo,
        ).length,
        completeness: added.length
          ? Math.round(
              added.reduce((sum, candidate) => sum + cardCompleteness(candidate), 0) /
                added.length,
            )
          : null,
      };
    })
    // Без всякой активности за период строку не показываем.
    .filter(
      (person) =>
        person.added > 0 ||
        person.jobsClosed > 0 ||
        person.hoursToFirstMove !== null ||
        jobs.some((job) => job.recruiterId === person.id && job.status === "OPEN"),
    );

  // ---------- Нанимающие менеджеры ----------
  const managers: ManagerStats[] = users
    .filter((user) => user.role === "HIRING_MANAGER")
    .map((user) => {
      const own = interviews.filter((interview) => interview.interviewerId === user.id);
      const authored = feedbacks.filter((feedback) => feedback.authorId === user.id);

      const delays: number[] = [];
      let awaiting = 0;
      for (const interview of own) {
        const end = new Date(
          interview.scheduledAt.getTime() + (interview.durationMinutes ?? 60) * 60_000,
        );
        const answer =
          authored.find((feedback) => feedback.interviewId === interview.id) ??
          authored.find(
            (feedback) =>
              feedback.candidateId === interview.candidateId &&
              feedback.createdAt >= interview.scheduledAt,
          );
        if (answer) delays.push(hoursBetweenDates(end, answer.createdAt));
        else if (end < now) awaiting += 1;
      }

      return {
        id: user.id,
        name: user.fullName,
        jobs: jobs.filter((job) => job.hiringManagerId === user.id && job.status === "OPEN")
          .length,
        interviews: own.length,
        feedbacks: authored.length,
        hoursToFeedback: medianOrNull(delays),
        awaiting,
      };
    });

  const tips = teamRecommendations(recruiters, managers);

  const th = "pb-2 font-normal";
  const td = "py-2.5";

  return (
    <section className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold text-ink-strong">Скорость работы команды</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Скорость работы рекрутеров и нанимающих менеджеров за выбранный период.
        Видно только администратору.
      </p>

      <h3 className="mt-5 text-sm font-semibold text-ink-strong">Рекрутеры</h3>
      {recruiters.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">
          За этот период рекрутеры ничего не делали в системе.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-soft">
                <th className={th}>Сотрудник</th>
                <th className={`${th} text-right`}>Добавил</th>
                <th
                  className={`${th} text-right`}
                  title="Сколько вакансий закрыто и медиана дней от открытия до закрытия"
                >
                  Закрыто · время найма
                </th>
                <th
                  className={`${th} text-right`}
                  title="Медиана дней от открытия вакансии до первого оффера"
                >
                  До оффера
                </th>
                <th
                  className={`${th} text-right`}
                  title="Медиана времени от добавления кандидата до первого перехода по этапам"
                >
                  Первый ответ
                </th>
                <th className={`${th} text-right`} title="Больше двух суток на первом этапе">
                  Ждут разбора
                </th>
                <th
                  className={`${th} text-right`}
                  title="Насколько заполнены карточки, которые завёл сотрудник"
                >
                  Заполненность
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recruiters.map((person) => (
                <tr key={person.id}>
                  <td className={`${td} font-medium text-ink`}>{person.name}</td>
                  <td className={`${td} text-right tabular-nums`}>{person.added}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {person.jobsClosed}
                    <span className="text-ink-soft">
                      {" · "}
                      {person.daysToClose === null ? "—" : `${person.daysToClose} дн`}
                    </span>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    {person.daysToOffer === null ? "—" : `${person.daysToOffer} дн`}
                  </td>
                  <td
                    className={`${td} text-right tabular-nums ${
                      (person.hoursToFirstMove ?? 0) > 48 ? "font-medium text-danger" : ""
                    }`}
                  >
                    {durationText(person.hoursToFirstMove)}
                  </td>
                  <td
                    className={`${td} text-right tabular-nums ${
                      person.untouched >= 5 ? "font-medium text-danger" : ""
                    }`}
                  >
                    {person.untouched}
                  </td>
                  <td className={`${td} text-right`}>
                    {person.completeness === null ? (
                      "—"
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                          <span
                            className={`block h-full rounded-full ${
                              person.completeness >= 80
                                ? "bg-khaki-strong"
                                : person.completeness >= 60
                                  ? "bg-accent"
                                  : "bg-danger"
                            }`}
                            style={{ width: `${person.completeness}%` }}
                          />
                        </span>
                        <span className="tabular-nums">{person.completeness}%</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold text-ink-strong">Нанимающие менеджеры</h3>
      {managers.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">В компании нет нанимающих менеджеров.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-soft">
                <th className={th}>Сотрудник</th>
                <th className={`${th} text-right`}>Открытых вакансий</th>
                <th className={`${th} text-right`}>Встреч</th>
                <th className={`${th} text-right`}>Отзывов</th>
                <th
                  className={`${th} text-right`}
                  title="Медиана времени от конца встречи до отзыва"
                >
                  Скорость отзыва
                </th>
                <th className={`${th} text-right`}>Без отзыва</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {managers.map((person) => (
                <tr key={person.id}>
                  <td className={`${td} font-medium text-ink`}>{person.name}</td>
                  <td className={`${td} text-right tabular-nums`}>{person.jobs}</td>
                  <td className={`${td} text-right tabular-nums`}>{person.interviews}</td>
                  <td className={`${td} text-right tabular-nums`}>{person.feedbacks}</td>
                  <td
                    className={`${td} text-right tabular-nums ${
                      (person.hoursToFeedback ?? 0) > 48 ? "font-medium text-danger" : ""
                    }`}
                  >
                    {durationText(person.hoursToFeedback)}
                  </td>
                  <td
                    className={`${td} text-right tabular-nums ${
                      person.awaiting >= 3 ? "font-medium text-danger" : ""
                    }`}
                  >
                    {person.awaiting}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tips.length > 0 && (
        <div className="mt-6 rounded-lg border border-warning-line bg-warning-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Lightbulb className="size-4 text-accent-ink" strokeWidth={1.8} aria-hidden />
            Рекомендации
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
