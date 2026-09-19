import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Настройки — LAMP" };

export default async function Page() {
  await requireSession();
  return <ComingSoon title="Настройки" description="Раздел появится на этапе 7: настройки компании и этапов подбора." />;
}
