import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { formatDateTime } from "@/lib/format";
import { buttonClass } from "@/components/ui/styles";
import {
  markAllNotificationsRead,
  markNotificationRead,
  openNotification,
} from "@/app/actions/notifications";

export const metadata: Metadata = { title: "Уведомления — LAMP" };

export default async function NotificationsPage() {
  const scope = await getScope();

  const notifications = await db.notification.findMany({
    where: { userId: scope.session.user.id },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const unread = notifications.filter((item) => !item.isRead).length;

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-strong">Уведомления</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {unread > 0 ? `Непрочитанных: ${unread}` : "Всё прочитано"}
          </p>
        </div>

        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-lg border border-line-strong px-3 py-2 text-sm text-ink transition hover:bg-canvas"
            >
              Отметить все прочитанными
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="text-sm text-ink-soft">
            Здесь появятся сообщения о назначенных интервью, новых кандидатах,
            сменах этапа и отзывах.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {notifications.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border p-4 ${
                item.isRead
                  ? "border-line bg-surface"
                  : "border-line bg-glow"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  {item.body && (
                    <p className="mt-0.5 text-sm text-ink-soft">{item.body}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-soft">
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>

                {!item.isRead && (
                  <form action={markNotificationRead} className="shrink-0">
                    <input
                      type="hidden"
                      name="notificationId"
                      value={item.id}
                    />
                    <button
                      type="submit"
                      className={buttonClass({ variant: "ghost", size: "sm" })}
                    >
                      Прочитано
                    </button>
                  </form>
                )}
              </div>

              {item.entityType === "Candidate" && item.entityId && (
                <form action={openNotification} className="mt-3">
                  <input type="hidden" name="notificationId" value={item.id} />
                  <button
                    type="submit"
                    className={buttonClass({ variant: "secondary", size: "sm" })}
                  >
                    Открыть кандидата
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
