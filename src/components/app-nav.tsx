"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  ChartColumn,
  LayoutDashboard,
  Settings,
  UserCog,
  Users,
} from "lucide-react";

// Главное меню системы. Один список — два вида отображения:
// слева на компьютере и снизу на телефоне.

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Вакансии", icon: Briefcase },
  { href: "/candidates", label: "Кандидаты", icon: Users },
  { href: "/interviews", label: "Интервью", icon: CalendarDays },
  { href: "/analytics", label: "Аналитика", icon: ChartColumn },
  { href: "/users", label: "Пользователи", icon: UserCog },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function AppNav({ variant }: { variant: "sidebar" | "bottom" }) {
  const pathname = usePathname();

  if (variant === "bottom") {
    return (
      <nav className="flex overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-18 flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[11px] ${
                active ? "text-ink" : "text-ink-soft"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${active ? "text-ink" : "text-ink-soft"}`}
                strokeWidth={active ? 2.2 : 1.8}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-accent/20 font-medium text-ink"
                : "text-ink-soft hover:bg-muted hover:text-ink"
            }`}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
