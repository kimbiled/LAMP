import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard — LAMP" };

export default async function DashboardPage() {
  const session = await requireSession();
  const companyId = session.user.companyId;

  // Обратите внимание: в каждом запросе стоит companyId.
  // Это и есть разделение компаний — увидеть чужие данные невозможно.
  const [openJobs, candidates, newCandidates, scheduledInterviews] =
    await Promise.all([
      db.job.count({ where: { companyId, status: "OPEN" } }),
      db.candidate.count({ where: { companyId } }),
      db.candidate.count({
        where: {
          companyId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      db.interview.count({ where: { companyId, status: "SCHEDULED" } }),
    ]);

  const metrics = [
    { label: "Активные вакансии", value: openJobs },
    { label: "Всего кандидатов", value: candidates },
    { label: "Новые за неделю", value: newCandidates },
    { label: "Назначенные интервью", value: scheduledInterviews },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold text-ink-strong">
        Здравствуйте, {session.user.fullName.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Рабочее пространство компании «{session.company.name}»
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-muted bg-surface p-4"
          >
            <p className="text-2xl font-semibold text-ink-strong">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-ink-soft">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-muted bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">С чего начать</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Рабочее пространство создано, этапы подбора готовы. Следующим шагом
          появятся разделы «Вакансии» и «Кандидаты» — тогда эти показатели
          начнут заполняться.
        </p>
      </div>
    </div>
  );
}
