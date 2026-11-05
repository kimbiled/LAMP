// Пока страница собирается на сервере, вместо белого экрана —
// спокойная заглушка в форме будущей страницы. Так видно, что
// нажатие сработало и данные уже едут.

export default function AppLoading() {
  return (
    <div className="animate-pulse" aria-busy="true">
      <span className="sr-only">Загружаем…</span>
      <div className="h-7 w-56 rounded-lg bg-muted" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-muted" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-xl border border-line bg-surface" />
        <div className="h-24 rounded-xl border border-line bg-surface" />
        <div className="h-24 rounded-xl border border-line bg-surface" />
      </div>
      <div className="mt-6 h-64 rounded-xl border border-line bg-surface" />
    </div>
  );
}
