import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireScope, assertOwnCompany } from "@/lib/tenant";
import { updateJob } from "@/app/actions/jobs";
import { JobForm } from "../../job-form";

export const metadata: Metadata = { title: "Редактирование вакансии — Skillo" };

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await requireScope("jobs.manage");

  const job = await db.job.findFirst({
    where: { id, companyId: scope.companyId },
  });

  assertOwnCompany(job, scope.companyId);
  if (!job) return null;

  const users = await db.user.findMany({
    where: { companyId: scope.companyId, isActive: true },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });

  // Привязываем идентификатор вакансии к действию: подменить его
  // через форму нельзя, он приходит с сервера.
  const action = updateJob.bind(null, job.id);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-ink-strong">
        Редактирование вакансии
      </h1>
      <p className="mt-1 text-sm text-ink-soft">{job.title}</p>

      <div className="mt-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
        <JobForm
          action={action}
          users={users}
          submitLabel="Сохранить"
          cancelHref={`/jobs/${job.id}`}
          values={{
            title: job.title,
            description: job.description ?? "",
            requirements: job.requirements ?? "",
            salaryMin: job.salaryMin?.toString() ?? "",
            salaryMax: job.salaryMax?.toString() ?? "",
            currency: job.currency,
            status: job.status,
            priority: job.priority,
            recruiterId: job.recruiterId ?? "",
            hiringManagerId: job.hiringManagerId ?? "",
          }}
        />
      </div>
    </div>
  );
}
