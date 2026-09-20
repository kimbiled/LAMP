"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  ChartColumn,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { can, type Permission } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/enums";

// Главное меню системы. Один список — два вида отображения:
// слева на компьютере и снизу на телефоне.

export const NAV_ITEMS: {
  href: string;
  label: string;
  // Короткое название для нижнего меню на телефоне, где мало места.
  shortLabel?: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
  // Пункт только для владельца системы — см. src/lib/superadmin.ts.
  ownerOnly?: boolean;
}[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Главная",
    icon: LayoutDashboard,
  },
  { href: "/jobs", label: "Вакансии", icon: Briefcase },
  { href: "/candidates", label: "Кандидаты", icon: Users },
  { href: "/interviews", label: "Интервью", icon: CalendarDays },
  {
    href: "/analytics",
    label: "Аналитика",
    icon: ChartColumn,
    permission: "analytics.view",
  },
  {
    href: "/users",
    label: "Пользователи",
    shortLabel: "Люди",
    icon: UserCog,
    permission: "users.manage",
  },
  { href: "/settings", label: "Настройки", icon: Settings },
  {
    href: "/system",
    label: "Система",
    icon: ShieldCheck,
    ownerOnly: true,
  },
];

export function AppNav({
  variant,
  role,
  isSuperAdmin = false,
}: {
  variant: "sidebar" | "bottom";
  role: Role;
  isSuperAdmin?: boolean;
}) {
  const pathname = usePathname();

  // Прятать пункты меню недостаточно: те же права проверяются
  // на сервере при открытии страницы. Здесь — только удобство.
  const items = NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && !isSuperAdmin) return false;
    return !item.permission || can(role, item.permission);
  });

  if (variant === "bottom") {
    return (
      <nav className="flex">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 ${
                active ? "text-accent" : "text-sidebar-text"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              <span className="w-full truncate text-center text-[10px]">
                {item.shortLabel ?? item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-accent font-medium text-ink"
                : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
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
