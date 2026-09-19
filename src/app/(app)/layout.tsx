import { LogOut } from "lucide-react";
import { requireSession } from "@/lib/session";
import { logout } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { ROLE_LABELS } from "@/lib/labels";

// Оболочка всех внутренних страниц.
// requireSession() проверяет вход НА СЕРВЕРЕ: без сессии страница
// даже не начнёт отрисовываться, человека отправит на /login.

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-muted bg-surface p-4 md:flex">
        <div className="mb-6 flex items-center gap-3 px-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-base font-semibold text-ink">
            L
          </span>
          <span className="text-base font-semibold text-ink-strong">LAMP</span>
        </div>

        <AppNav variant="sidebar" />

        <div className="mt-auto border-t border-muted pt-4">
          <p className="truncate px-1 text-sm font-medium text-ink">
            {session.user.fullName}
          </p>
          <p className="truncate px-1 text-xs text-ink-soft">
            {ROLE_LABELS[session.user.role]}
          </p>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft transition hover:bg-muted hover:text-ink"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.8} />
              Выйти
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-muted bg-surface px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
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

          <form action={logout} className="md:hidden">
            <button
              type="submit"
              aria-label="Выйти"
              className="rounded-lg p-2 text-ink-soft transition hover:bg-muted hover:text-ink"
            >
              <LogOut className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </form>
        </header>

        <main className="flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
          {children}
        </main>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-muted bg-surface md:hidden">
          <AppNav variant="bottom" />
        </div>
      </div>
    </div>
  );
}
