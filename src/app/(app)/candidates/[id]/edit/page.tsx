import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getScope, assertOwnCompany } from "@/lib/tenant";
import {
  candidateVisibilityFilter,
  jobVisibilityFilter,
} from "@/lib/permissions";
import { updateCandidate } from "@/app/actions/candidates";
import { CandidateForm } from "../../candidate-form";
import { findDuplicates } from "@/lib/duplicates";
import { ResumeText } from "./resume-text";

export const metadata: Metadata = { title: "Редактирование кандидата — LAMP" };

export default async function EditCandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ parsed?: string; duplicate?: string }>;
}) {
  const { id } = await params;
  const { parsed, duplicate } = await searchParams;
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
      // Текст текущего резюме — показываем рядом с формой, чтобы
      // пропущенное системой можно было скопировать, а не перепечатывать.
      resumes: {
        where: { isCurrent: true },
        orderBy: { uploadedAt: "desc" },
        select: { parsedText: true },
        take: 1,
      },
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
  const resumeText = candidate.resumes[0]?.parsedText ?? null;

  // Резюме загрузили, а человек с такими контактами уже был.
  // Лишний запрос делаем только по отметке в адресе, а не каждый раз.
  const duplicates = duplicate
    ? await findDuplicates({
        companyId: scope.companyId,
        phone: candidate.phone,
        email: candidate.email,
        exceptId: candidate.id,
      })
    : [];

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-ink-strong">
        Редактирование карточки
      </h1>
      <p className="mt-1 text-sm text-ink-soft">{candidate.fullName}</p>

      {parsed && (
        <div className="mt-4 rounded-xl border border-line bg-glow p-4">
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

      {duplicates.length > 0 && (
        <div className="mt-4 rounded-xl border border-danger-line bg-danger-soft/60 p-4">
          <p className="text-sm font-medium text-ink">
            Похоже, этот человек уже есть в базе
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Совпали контакты. Карточка из резюме уже создана — если это тот же
            человек, перенесите нужное в старую карточку и удалите новую.
          </p>

          <ul className="mt-3 space-y-2">
            {duplicates.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{item.fullName}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {item.stageName}
                    {item.jobTitle ? ` · ${item.jobTitle}` : ""} · совпадение по{" "}
                    {item.matchedBy === "phone" ? "телефону" : "почте"}
                  </p>
                </div>
                <Link
                  href={`/candidates/${item.id}`}
                  className="rounded-lg border border-line-strong px-3 py-1.5 text-xs text-ink transition hover:bg-canvas"
                >
                  Открыть карточку
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resumeText && <ResumeText text={resumeText} />}

      <div className="mt-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
        <CandidateForm
          action={action}
          jobs={jobs}
          stages={stages}
          fromParse={Boolean(parsed)}
          submitLabel="Сохранить"
          cancelHref={`/candidates/${candidate.id}`}
          experience={candidate.experience.map((item) => ({
            companyName: item.companyName,
            position: item.position ?? "",
            period: item.period ?? "",
            description: item.description ?? "",
          }))}
          education={candidate.education.map((item) => ({
            institution: item.institution,
            specialty: item.specialty ?? "",
            years: item.years ?? "",
          }))}
          values={{
            fullName: candidate.fullName,
            jobId: candidate.jobId ?? "",
            stageId: candidate.stageId,
            phone: candidate.phone ?? "",
            email: candidate.email ?? "",
            city: candidate.city ?? "",
            birthDate: candidate.birthDate
              ? candidate.birthDate.toISOString().slice(0, 10)
              : "",
            currentPosition: candidate.currentPosition ?? "",
            experienceYears: candidate.experienceYears?.toString() ?? "",
            salaryExpectation: candidate.salaryExpectation?.toString() ?? "",
            currency: candidate.currency,
            telegram: candidate.telegram ?? "",
            skills: candidate.skills.join(", "),
            languages: candidate.languages.join(", "),
            source: candidate.source ?? "",
            sourceChannel: candidate.sourceChannel ?? "",
            note: candidate.note ?? "",
          }}
        />
      </div>
    </div>
  );
}
