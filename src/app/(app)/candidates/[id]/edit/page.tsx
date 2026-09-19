import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getScope, assertOwnCompany } from "@/lib/tenant";
import {
  candidateVisibilityFilter,
  jobVisibilityFilter,
} from "@/lib/permissions";
import { updateCandidate } from "@/app/actions/candidates";
import { CandidateForm } from "../../candidate-form";

export const metadata: Metadata = { title: "Редактирование кандидата — LAMP" };

export default async function EditCandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ parsed?: string }>;
}) {
  const { id } = await params;
  const { parsed } = await searchParams;
  const scope = await getScope();

  if (!scope.can("candidates.edit")) {
    notFound();
  }

  const candidate = await db.candidate.findFirst({
    where: {
      id,
      companyId: scope.companyId,
      ...candidateVisibilityFilter(scope.session.user),
    },
    include: {
      experience: { orderBy: { sortOrder: "asc" } },
      education: { orderBy: { sortOrder: "asc" } },
    },
  });

  assertOwnCompany(candidate, scope.companyId);
  if (!candidate) return null;

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

  const action = updateCandidate.bind(null, candidate.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-ink-strong">
        Редактирование карточки
      </h1>
      <p className="mt-1 text-sm text-ink-soft">{candidate.fullName}</p>

      {parsed && (
        <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-sm font-medium text-ink">
            Данные распознаны из резюме
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Проверьте поля и исправьте, если система ошиблась. Контакты обычно
            определяются точно, а опыт и образование — не всегда. Файл резюме
            уже прикреплён к карточке.
          </p>
        </div>
      )}

      {(candidate.experience.length > 0 || candidate.education.length > 0) && (
        <section className="mt-4 rounded-xl border border-muted bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">Распознано из резюме</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Эти записи уже сохранены и видны в карточке кандидата.
          </p>

          {candidate.experience.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-ink-soft">Опыт работы</p>
              <ul className="mt-1.5 space-y-2">
                {candidate.experience.map((item) => (
                  <li key={item.id} className="border-l-2 border-muted pl-3">
                    <p className="text-sm font-medium text-ink">
                      {item.companyName}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {item.position ?? "должность не распознана"}
                      {item.period ? ` · ${item.period}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {candidate.education.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-ink-soft">Образование</p>
              <ul className="mt-1.5 space-y-2">
                {candidate.education.map((item) => (
                  <li key={item.id} className="border-l-2 border-muted pl-3">
                    <p className="text-sm font-medium text-ink">
                      {item.institution}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {item.specialty ?? ""}
                      {item.years ? ` · ${item.years}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="mt-6 rounded-xl border border-muted bg-surface p-6">
        <CandidateForm
          action={action}
          jobs={jobs}
          stages={stages}
          submitLabel="Сохранить"
          cancelHref={`/candidates/${candidate.id}`}
          values={{
            fullName: candidate.fullName,
            jobId: candidate.jobId ?? "",
            stageId: candidate.stageId,
            phone: candidate.phone ?? "",
            email: candidate.email ?? "",
            city: candidate.city ?? "",
            currentPosition: candidate.currentPosition ?? "",
            experienceYears: candidate.experienceYears?.toString() ?? "",
            salaryExpectation: candidate.salaryExpectation?.toString() ?? "",
            currency: candidate.currency,
            telegram: candidate.telegram ?? "",
            skills: candidate.skills.join(", "),
            languages: candidate.languages.join(", "),
            source: candidate.source ?? "",
            note: candidate.note ?? "",
          }}
        />
      </div>
    </div>
  );
}
