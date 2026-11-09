import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { nextUnlock, readLook } from "@/lib/mascot";
import { closedThisMonth } from "@/lib/mascot-progress";
import { plural } from "@/lib/format";
import { MascotEditor } from "./mascot-editor";

export const metadata: Metadata = { title: "Мой персонаж — LAMP" };

const JOB_FORMS: [string, string, string] = ["вакансию", "вакансии", "вакансий"];

// Мой персонаж: примерочная. Вещи открываются за закрытые вакансии
// в этом месяце — где вы рекрутер или нанимающий менеджер.
export default async function MascotPage() {
  const scope = await getScope();
  const [user, closed] = await Promise.all([
    db.user.findUnique({ where: { id: scope.session.user.id }, select: { mascot: true } }),
    closedThisMonth(scope.session.user.id, scope.companyId),
  ]);
  const next = nextUnlock(closed);

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-strong">Мой персонаж</h1>
      <p className="mt-1 text-sm text-ink-soft">
        В этом месяце вы закрыли {closed} {plural(closed, JOB_FORMS)}.{" "}
        {next
          ? `Ещё ${next.need} — и откроется «${next.label}».`
          : "Открыто всё — вы лучший рекрутер месяца!"}{" "}
        Счёт обнуляется первого числа, но надетое остаётся.
      </p>
      <MascotEditor initial={readLook(user?.mascot)} closed={closed} />
    </div>
  );
}
