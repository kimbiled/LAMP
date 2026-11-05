import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireScope } from "@/lib/tenant";
import { jobVisibilityFilter } from "@/lib/permissions";
import { BackButton } from "@/components/back-button";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Импорт с hh — LAMP" };

export default async function ImportPage() {
  const scope = await requireScope("candidates.create");

  const jobs = await db.job.findMany({
    where: {
      companyId: scope.companyId,
      status: "OPEN",
      ...jobVisibilityFilter(scope.session.user),
    },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-3xl">
      <BackButton fallbackHref="/candidates" fallbackLabel="К кандидатам" />

      <h1 className="mt-3 text-xl font-semibold text-ink-strong">
        Импорт кандидатов с hh
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Загрузите файл, который выгрузило расширение. Резюме разберутся сами —
        имя, контакты, опыт и навыки заполнятся из файла, а ссылка на hh
        сохранится в карточке.
      </p>

      <ImportForm jobs={jobs} />
    </div>
  );
}
