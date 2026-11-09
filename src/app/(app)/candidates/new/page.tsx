import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { jobVisibilityFilter } from "@/lib/permissions";
import { createCandidate } from "@/app/actions/candidates";
import { createCandidateFromResume } from "@/app/actions/resumes";
import { ResumeUploadForm } from "@/components/resume-upload-form";
import { CandidateForm } from "../candidate-form";

export const metadata: Metadata = { title: "Новый кандидат — Skillo" };

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
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-ink-strong">Новый кандидат</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Загрузите резюме — или заполните карточку вручную
      </p>

      <section className="mt-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold text-ink-strong">
          Загрузка резюме
        </h2>
        <p className="mt-1 mb-4 text-xs text-ink-soft">
          Система прочитает файл и сама заполнит карточку. После этого вы
          проверите распознанные данные и при необходимости исправите их.
        </p>

        <ResumeUploadForm
          action={createCandidateFromResume}
          submitLabel="Загрузить и распознать"
          pendingLabel="Читаем резюме…"
          jobId={job}
        />
      </section>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-muted" />
        <span className="text-xs text-ink-soft">или заполните вручную</span>
        <span className="h-px flex-1 bg-muted" />
      </div>

      <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <CandidateForm
          action={createCandidate}
          jobs={jobs}
          stages={stages}
          submitLabel="Добавить кандидата"
          cancelHref="/candidates"
          experience={[]}
          education={[]}
          values={{
            fullName: "",
            jobId: job ?? "",
            stageId: stages[0]?.id ?? "",
            phone: "",
            email: "",
            city: "",
            birthDate: "",
            currentPosition: "",
            experienceYears: "",
            salaryExpectation: "",
            currency: "KZT",
            telegram: "",
            skills: "",
            languages: "",
            source: "",
            sourceChannel: "",
            referredBy: "",
            note: "",
          }}
        />
      </div>
    </div>
  );
}
