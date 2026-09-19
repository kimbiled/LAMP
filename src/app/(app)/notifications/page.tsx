import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getScope } from "@/lib/tenant";
import { formatDateTime } from "@/lib/format";
import {
  markAllNotificationsRead,
  markNotificationRead,
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
    <div className="mx-auto max-w-2xl">
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
              className="rounded-lg border border-muted px-3 py-2 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
            >
              Отметить все прочитанными
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-muted bg-surface p-10 text-center">
          <p className="text-sm text-ink-soft">
            Здесь появятся сообщения о назначенных интервью, новых кандидатах,
            сменах этапа и фидбэках.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {notifications.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border p-4 ${
                item.isRead
                  ? "border-muted bg-surface"
                  : "border-accent/40 bg-accent/10"
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
                      className="rounded-lg border border-muted bg-surface px-2.5 py-1 text-xs text-ink-soft transition hover:border-ink-soft hover:text-ink"
                    >
                      Прочитано
                    </button>
                  </form>
                )}
              </div>

              {item.entityType === "Candidate" && item.entityId && (
                <Link
                  href={`/candidates/${item.entityId}`}
                  className="mt-2 inline-block text-xs text-ink underline transition hover:text-ink-strong"
                >
                  Открыть кандидата
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
