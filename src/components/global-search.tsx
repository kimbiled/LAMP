import { Search } from "lucide-react";

// Поиск в шапке. Работает на любой странице и ведёт в раздел
// «Кандидаты» с уже применённым запросом.

export function GlobalSearch() {
  return (
    <form action="/candidates" className="relative w-full max-w-xs">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-soft"
        strokeWidth={1.8}
      />
      <input
        type="search"
        name="q"
        placeholder="Поиск кандидатов"
        aria-label="Поиск кандидатов"
        className="w-full rounded-lg border border-line-strong bg-canvas py-2 pr-3 pl-9 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-ink focus:bg-surface focus:ring-2 focus:ring-accent"
      />
    </form>
  );
}
