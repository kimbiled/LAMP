import "server-only";
import { db } from "@/lib/db";
import { todayLocal } from "@/lib/time";

// Сколько вакансий человек закрыл в этом месяце — как рекрутер или
// как нанимающий менеджер. По этому числу открываются вещи персонажа.
export async function closedThisMonth(userId: string, companyId: string): Promise<number> {
  const month = todayLocal().slice(0, 7);
  const start = new Date(`${month}-01T00:00:00Z`);
  return db.job.count({
    where: {
      companyId,
      status: "CLOSED",
      closedAt: { gte: start },
      OR: [{ recruiterId: userId }, { hiringManagerId: userId }],
    },
  });
}
