export default function Home() {
  const done = [
    "Next.js и TypeScript подключены",
    "Tailwind CSS работает",
    "Фирменные цвета применены",
  ];

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-muted bg-surface p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
            <span className="text-lg font-semibold text-ink">L</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink-strong">LAMP</h1>
            <p className="text-sm text-ink-soft">Система подбора персонала</p>
          </div>
        </div>

        <div className="rounded-xl bg-muted p-5">
          <p className="text-sm font-medium text-ink">Этап 2: проект создан</p>
          <ul className="mt-3 space-y-2">
            {done.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-xs text-ink-soft">
          Следующий шаг — база данных и регистрация компаний.
        </p>
      </div>
    </main>
  );
}
