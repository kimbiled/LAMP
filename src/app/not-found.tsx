import Link from "next/link";

// Эта страница показывается, если адрес не существует
// или если у человека нет прав на раздел.

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-xl font-semibold text-ink">
        L
      </span>

      <h1 className="mt-6 text-xl font-semibold text-ink-strong">
        Страница не найдена
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">
        Возможно, адрес указан неверно, страница была удалена или у вас нет
        доступа к этому разделу.
      </p>

      <Link
        href="/dashboard"
        className="mt-6 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-hover"
      >
        Вернуться на главную
      </Link>
    </div>
  );
}
