import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Кандидаты — LAMP" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Кандидаты" description="Раздел появится на этапе 9: карточки кандидатов, загрузка резюме и поиск." />;
}
