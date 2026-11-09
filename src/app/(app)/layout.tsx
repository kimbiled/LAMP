import Link from "next/link";
import { LogOut, Search } from "lucide-react";
import { requireSession } from "@/lib/session";
import { logout } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { NavMemory } from "@/components/nav-memory";
import { ROLE_LABELS } from "@/lib/labels";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/dialog";
import { MeetingDefaultsProvider } from "@/components/meeting-defaults";
import { db } from "@/lib/db";
import { Mascot } from "@/components/mascot";
import { readLook } from "@/lib/mascot";

// Оболочка всех внутренних страниц.
// requireSession() проверяет вход НА СЕРВЕРЕ: без сессии страница
// даже не начнёт отрисовываться, человека отправит на /login.

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  // Своя комната Google Meet и шаблон приглашения — для кнопок
  // в формах интервью на любой странице. Если своей ссылки нет,
  // берётся старая общая ссылка компании.
  const [me, company] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { meetingLink: true, inviteTemplate: true, mascot: true },
    }),
    db.company.findUnique({
      where: { id: session.user.companyId },
      select: { meetingLink: true },
    }),
  ]);

  return (
    <ToastProvider>
    <ConfirmProvider>
    <MeetingDefaultsProvider
      link={me?.meetingLink ?? company?.meetingLink ?? null}
      template={me?.inviteTemplate ?? ""}
      recruiterName={session.user.fullName}
      companyName={session.company.name}
    >
    <div className="min-h-screen md:flex">
      <NavMemory />

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <div className="mb-6 flex items-center gap-3 px-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-base font-semibold text-ink">
            L
          </span>
          <span className="text-base font-semibold text-sidebar-text-active">
            LAMP
          </span>
        </div>

        <AppNav
          variant="sidebar"
          role={session.user.role}
          isSuperAdmin={session.user.isSuperAdmin}
        />

        <div className="mt-auto border-t border-sidebar-border pt-4">
          {/* Персонаж и имя: нажатие открывает примерочную. */}
          <Link
            href="/mascot"
            title="Мой персонаж — нарядить"
            className="flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-sidebar-hover"
          >
            <Mascot look={readLook(me?.mascot)} size={40} title="Мой персонаж" className="shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-sidebar-text-active">
                {session.user.fullName}
              </span>
              <span className="block truncate text-xs text-sidebar-text">
                {ROLE_LABELS[session.user.role]}
              </span>
            </span>
          </Link>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-text transition hover:bg-sidebar-hover hover:text-sidebar-text-active"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.8} />
              Выйти
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-ink md:hidden">
              L
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {session.company.name}
              </p>
              <p className="truncate text-xs text-ink-soft md:hidden">
                {session.user.fullName}
              </p>
            </div>
          </div>

          <div className="ml-auto hidden md:block">
            <GlobalSearch />
          </div>

          {/* На телефоне поле поиска не помещается в шапку —
              ведём на список кандидатов, где поиск сверху. */}
          <Link
            href="/candidates"
            aria-label="Поиск кандидатов"
            className="ml-auto inline-flex items-center justify-center rounded-lg p-2.5 text-ink-soft transition hover:bg-muted hover:text-ink md:hidden"
          >
            <Search className="h-5 w-5" strokeWidth={1.8} />
          </Link>

          <div className="flex md:ml-0">
            <NotificationBell count={session.unreadNotifications} />
          </div>

          <form action={logout} className="md:hidden">
            <button
              type="submit"
              aria-label="Выйти"
              className="rounded-lg p-2.5 text-ink-soft transition hover:bg-muted hover:text-ink"
            >
              <LogOut className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </form>
        </header>

        {/* Одна ширина и один левый край для всех страниц. Раньше каждая
            страница задавала свою ширину (от 448 до 1152 пикселей) и сама
            вставала по центру — заголовок при переходе прыгал с места
            на место. Узкие формы теперь прижаты к тому же левому краю. */}
        <main id="main" className="flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-sidebar-border bg-sidebar md:hidden">
          <AppNav
            variant="bottom"
            role={session.user.role}
            isSuperAdmin={session.user.isSuperAdmin}
          />
        </div>
      </div>
    </div>
    </MeetingDefaultsProvider>
    </ConfirmProvider>
    </ToastProvider>
  );
}
