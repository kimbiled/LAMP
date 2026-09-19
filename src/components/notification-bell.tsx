import Link from "next/link";
import { Bell } from "lucide-react";

// Колокольчик с числом непрочитанных уведомлений.

export function NotificationBell({ count }: { count: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={
        count > 0 ? `Уведомления: ${count} новых` : "Уведомления"
      }
      className="relative rounded-lg p-2 text-ink-soft transition hover:bg-muted hover:text-ink"
    >
      <Bell className="h-5 w-5" strokeWidth={1.8} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-ink">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
