import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Аналитика — LAMP" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Аналитика" description="Раздел появится на этапе 20: воронка подбора и показатели работы." />;
}
