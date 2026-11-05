import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "@/components/ui/styles";
import { plural, CANDIDATE_FORMS } from "@/lib/format";

// Переключение страниц длинного списка. Номер страницы — в адресе (?page=2),
// поэтому ссылку на вторую страницу можно отправить коллеге, а кнопка
// «Назад» в браузере работает как ожидается. Фильтры сохраняются.

export const PAGE_SIZE = 50;

export function parsePage(raw: string | undefined): number {
  const page = Number(raw);
  return Number.isInteger(page) && page > 1 ? page : 1;
}

export function Pagination({
  page,
  total,
  basePath,
  params,
}: {
  page: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;

  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
  };

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <nav
      aria-label="Страницы списка"
      className="mt-5 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-ink-soft">
        Показаны {from}–{to} из {total} {plural(total, CANDIDATE_FORMS)}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonClass({ variant: "secondary" })}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Назад
          </Link>
        ) : (
          <span className={buttonClass({ variant: "secondary", className: "pointer-events-none opacity-50" })}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Назад
          </span>
        )}
        <span className="px-2 text-sm text-ink">
          {page} из {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={buttonClass({ variant: "secondary" })}>
            Дальше
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <span className={buttonClass({ variant: "secondary", className: "pointer-events-none opacity-50" })}>
            Дальше
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}
