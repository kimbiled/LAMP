import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { jobVisibilityFilter } from "@/lib/permissions";
import { createCandidate } from "@/app/actions/candidates";
import { CandidateForm } from "../candidate-form";

export const metadata: Metadata = { title: "Новый кандидат — LAMP" };

export default async function NewCandidatePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const scope = await getScope();
  if (!scope.can("candidates.create")) {
    notFound();
  }

  const { job } = await searchParams;

  const [jobs, stages] = await Promise.all([
    db.job.findMany({
      where: {
        companyId: scope.companyId,
        ...jobVisibilityFilter(scope.session.user),
      },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
    db.stage.findMany({
      where: { companyId: scope.companyId },
      select: { id: true, name: true },
      orderBy: { position: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-ink-strong">Новый кандидат</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Обязательное поле только одно — ФИО. Остальное можно дополнить позже
      </p>

      <div className="mt-6 rounded-xl border border-muted bg-surface p-6">
        <CandidateForm
          action={createCandidate}
          jobs={jobs}
          stages={stages}
          submitLabel="Добавить кандидата"
          cancelHref="/candidates"
          values={{
            fullName: "",
            jobId: job ?? "",
            stageId: stages[0]?.id ?? "",
            phone: "",
            email: "",
            city: "",
            currentPosition: "",
            experienceYears: "",
            salaryExpectation: "",
            currency: "KZT",
            telegram: "",
            skills: "",
            languages: "",
            source: "",
            note: "",
          }}
        />
      </div>

      <p className="mt-4 text-xs text-ink-soft">
        Загрузка резюме в PDF и DOCX с автоматическим распознаванием данных
        появится на следующем шаге.
      </p>
    </div>
  );
}
