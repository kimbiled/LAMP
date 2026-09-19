// Показывается мгновенно при переходе между разделами, пока сервер
// готовит страницу. Без этого экран замирает на старом содержимом
// и кажется, что нажатие не сработало.

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse">
      <div className="h-6 w-48 rounded-lg bg-muted" />
      <div className="mt-2 h-4 w-64 rounded-lg bg-muted" />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>

      <div className="mt-6 h-64 rounded-xl bg-muted" />
    </div>
  );
}
