import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Пользователи — LAMP" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Пользователи" description="Раздел появится на этапе 7: приглашение сотрудников, роли и блокировка." />;
}
