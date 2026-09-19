import Link from "next/link";

// Общая рамка для страниц входа и регистрации: логотип и карточка по центру.

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-ink">
          L
        </span>
        <span className="text-lg font-semibold text-ink-strong">LAMP</span>
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-muted bg-surface p-7">
        {children}
      </div>

      <p className="mt-6 text-xs text-ink-soft">
        Система подбора персонала
      </p>
    </div>
  );
}
