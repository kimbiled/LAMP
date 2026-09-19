import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Вакансии — LAMP" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Вакансии" description="Раздел появится на этапе 8: создание вакансий и Kanban-доска кандидатов." />;
}
