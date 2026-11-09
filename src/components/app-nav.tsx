"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  ChartColumn,
  Ellipsis,
  LayoutDashboard,
  NotebookPen,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { can, type Permission } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/enums";

// Главное меню системы. Один список — два вида отображения:
// слева на компьютере и снизу на телефоне.
//
// Внизу на телефоне помещается не больше пяти пунктов с читаемой подписью,
// поэтому там первые четыре пункта и «Ещё», за которым остальные.
const BOTTOM_PRIMARY = 4;

export const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
  // Пункт только для владельца системы — см. src/lib/superadmin.ts.
  ownerOnly?: boolean;
}[] = [
  {
    href: "/dashboard",
    label: "Главная",
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
  // Личный блокнот: дела на день и заметки по кандидатам.
  // Есть у всех — у каждого свой.
  { href: "/notebook", label: "Блокнот", icon: NotebookPen },
  {
    href: "/users",
    label: "Пользователи",
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
  const router = useRouter();

  // Страница собирается на сервере, и между нажатием и её появлением
  // проходит несколько сотен миллисекунд. Без отклика кажется, что
  // нажатие не сработало, и человек жмёт второй раз. Поэтому пункт
  // подсвечивается сразу, ещё до того, как страница пришла.
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState<string | null>(null);

  // Прятать пункты меню недостаточно: те же права проверяются
  // на сервере при открытии страницы. Здесь — только удобство.
  const items = NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && !isSuperAdmin) return false;
    return !item.permission || can(role, item.permission);
  });

  function go(event: React.MouseEvent, href: string) {
    // Средняя кнопка мыши и Ctrl+клик открывают новую вкладку —
    // в эти случаи не вмешиваемся.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      return;
    }

    event.preventDefault();
    setClicked(href);
    startTransition(() => router.push(href));
  }

  // Пока страница едет, подсвечен тот пункт, по которому нажали.
  const highlighted = pending && clicked ? clicked : null;

  const isActive = (href: string) =>
    highlighted ? href === highlighted : pathname.startsWith(href);

  if (variant === "bottom") {
    return <BottomNav items={items} isActive={isActive} go={go} />;
  }

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(event) => go(event, item.href)}
            aria-current={active ? "page" : undefined}
            // Текущий раздел: мягкая жёлтая подложка, тёмная полоска
            // слева и жирный текст. Сплошной ярко-жёлтой заливки нет:
            // на светлом меню она кричала бы громче главных кнопок.
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
              active
                ? "bg-glow font-semibold text-sidebar-text-active shadow-[inset_3px_0_0_var(--color-ink-strong)]"
                : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
            }`}
          >
            <Icon
              className={`h-4.5 w-4.5 ${active ? "text-accent-ink" : ""}`}
              strokeWidth={active ? 2.1 : 1.8}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

type NavItem = (typeof NAV_ITEMS)[number];

function BottomNav({
  items,
  isActive,
  go,
}: {
  items: NavItem[];
  isActive: (href: string) => boolean;
  go: (event: React.MouseEvent, href: string) => void;
}) {
  const pathname = usePathname();
  // Список «Ещё» помнит, на какой странице его открыли: перешли на
  // другую — он закрыт сам, без лишних перерисовок.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const moreOpen = openedOn === pathname;

  const primary = items.length > BOTTOM_PRIMARY + 1 ? items.slice(0, BOTTOM_PRIMARY) : items;
  const rest = items.length > BOTTOM_PRIMARY + 1 ? items.slice(BOTTOM_PRIMARY) : [];
  const restActive = rest.some((item) => isActive(item.href));

  const cell =
    "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pt-1.5 pb-1.5 text-xs leading-tight";

  return (
    <>
      {moreOpen && (
        <div
          id="nav-more"
          className="absolute inset-x-0 bottom-full border-t border-sidebar-border bg-sidebar px-3 py-2 shadow-lg"
        >
          {rest.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => go(event, item.href)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-base ${
                  active ? "bg-glow font-semibold text-sidebar-text-active" : "text-sidebar-text-active hover:bg-sidebar-hover"
                }`}
              >
                <Icon className="size-5" strokeWidth={1.8} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
      <nav className="flex pb-[env(safe-area-inset-bottom)]" aria-label="Главное меню">
        {primary.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(event) => go(event, item.href)}
              aria-current={active ? "page" : undefined}
              className={`${cell} ${active ? "font-semibold text-sidebar-text-active" : "text-sidebar-text"}`}
            >
              {/* Текущий раздел — значок в жёлтой «таблетке», как
                  в привычных телефонных приложениях. */}
              <span className={`flex h-8 w-14 items-center justify-center rounded-full ${active ? "bg-glow text-accent-ink" : ""}`}>
                <Icon className="size-6 shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              </span>
              <span className="w-full text-center">{item.label}</span>
            </Link>
          );
        })}
        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenedOn(moreOpen ? null : pathname)}
            aria-expanded={moreOpen}
            aria-controls="nav-more"
            className={`${cell} ${restActive || moreOpen ? "font-semibold text-sidebar-text-active" : "text-sidebar-text"}`}
          >
            <span className={`flex h-8 w-14 items-center justify-center rounded-full ${restActive ? "bg-glow text-accent-ink" : moreOpen ? "bg-sidebar-hover" : ""}`}>
              <Ellipsis className="size-6 shrink-0" strokeWidth={1.8} aria-hidden />
            </span>
            <span>Ещё</span>
          </button>
        )}
      </nav>
    </>
  );
}
