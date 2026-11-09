import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireScope } from "@/lib/tenant";
import { createJob } from "@/app/actions/jobs";
import { JobForm } from "../job-form";

export const metadata: Metadata = { title: "Новая вакансия — Skillo" };

export default async function NewJobPage() {
  const scope = await requireScope("jobs.manage");

  const users = await db.user.findMany({
    where: { companyId: scope.companyId, isActive: true },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-ink-strong">Новая вакансия</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Заполните основное — остальное можно дописать позже
      </p>

      <div className="mt-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
        <JobForm
          action={createJob}
          users={users}
          submitLabel="Создать вакансию"
          cancelHref="/jobs"
          values={{
            title: "",
            description: "",
            requirements: "",
            salaryMin: "",
            salaryMax: "",
            currency: "KZT",
            status: "OPEN",
            priority: "MEDIUM",
            recruiterId: scope.session.user.id,
            hiringManagerId: "",
          }}
        />
      </div>
    </div>
  );
}
