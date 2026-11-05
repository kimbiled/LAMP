import { formatMonths, periodMonths } from "@/lib/resume/score";

// Опыт работы кандидата — как в резюме на hh: слева период
// и сколько длилось, справа должность, компания и обязанности
// списком. Один и тот же блок на карточке кандидата, в разделе
// владельца системы и на странице по ссылке «Поделиться».

type Experience = {
  id: string;
  companyName: string;
  position: string | null;
  period: string | null;
  description: string | null;
};

// hh считает месяцы включительно: «Март 2024 — Июль 2026» — это
// 2 года 5 месяцев. Считаем так же, чтобы цифры совпадали с резюме.
function duration(period: string | null): string | null {
  const months = periodMonths(period);
  return months > 0 ? formatMonths(months + 1) : null;
}

// Подзаголовок внутри описания: «Достижения:», «Обязанности:».
const isHeading = (line: string) => line.endsWith(":") && line.length < 50;

// Пункт с номером: «1 - Заменил бумажный учёт…».
const isNumbered = (line: string) => /^\d{1,2}\s*[-–—.)]\s+\S/.test(line);

// Перечень технологий: «React · TypeScript · Zustand».
const isTechStack = (line: string) =>
  (line.match(/\s·\s/g) ?? []).length >= 2;

function Description({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Одна фраза — просто абзац, без точки-маркера.
  if (lines.length === 1) {
    return <p className="mt-2 text-sm leading-relaxed text-ink">{lines[0]}</p>;
  }

  return (
    <ul className="mt-2 space-y-1 text-sm leading-relaxed text-ink">
      {lines.map((line, index) =>
        isHeading(line) ? (
          <li key={index} className="pt-1.5 font-medium">
            {line}
          </li>
        ) : isTechStack(line) ? (
          <li key={index} className="break-words text-xs text-ink-soft">
            {line}
          </li>
        ) : isNumbered(line) ? (
          // Номер сам служит маркером — точку не ставим.
          <li key={index} className="break-words">
            {line}
          </li>
        ) : (
          <li key={index} className="flex gap-2">
            <span
              aria-hidden
              className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-ink-soft"
            />
            <span className="min-w-0 break-words">{line}</span>
          </li>
        ),
      )}
    </ul>
  );
}

export function ExperienceList({ items }: { items: Experience[] }) {
  return (
    <ol className="divide-y divide-line">
      {items.map((item) => {
        const length = duration(item.period);

        return (
          <li
            key={item.id}
            className="grid gap-x-6 gap-y-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr]"
          >
            <div className="text-sm text-ink-soft">
              {item.period && <p>{item.period}</p>}
              {length && <p className="text-xs">{length}</p>}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-ink-strong">
                {item.position ?? "Должность не указана"}
              </p>
              <p className="text-sm text-ink">{item.companyName}</p>
              {item.description && <Description text={item.description} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
