import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Интервью — LAMP" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Интервью" description="Раздел появится на этапе 14: назначение интервью и календарь." />;
}
