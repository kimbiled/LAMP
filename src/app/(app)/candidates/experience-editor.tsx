"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

// Редакторы опыта работы и образования.
// Каждая строка — обычные поля формы с одинаковыми именами.
// Сервер получает их параллельными списками и сохраняет по порядку.

export type ExperienceRow = {
  companyName: string;
  position: string;
  period: string;
  description: string;
};

export type EducationRow = {
  institution: string;
  specialty: string;
  years: string;
};

const inputClass =
  "w-full rounded-lg border border-muted bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent/30";

function emptyExperience(): ExperienceRow {
  return { companyName: "", position: "", period: "", description: "" };
}

function emptyEducation(): EducationRow {
  return { institution: "", specialty: "", years: "" };
}

export function ExperienceEditor({ initial }: { initial: ExperienceRow[] }) {
  const [rows, setRows] = useState<ExperienceRow[]>(
    initial.length > 0 ? initial : [emptyExperience()],
  );

  const update = (index: number, patch: Partial<ExperienceRow>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium text-ink">Опыт работы</h2>

      {rows.map((row, index) => (
        <div
          key={index}
          className="space-y-2 rounded-lg border border-muted bg-canvas p-3"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              name="expCompany"
              value={row.companyName}
              onChange={(event) =>
                update(index, { companyName: event.target.value })
              }
              placeholder="Компания"
              aria-label="Компания"
              className={inputClass}
            />
            <input
              name="expPosition"
              value={row.position}
              onChange={(event) =>
                update(index, { position: event.target.value })
              }
              placeholder="Должность"
              aria-label="Должность"
              className={inputClass}
            />
          </div>

          <input
            name="expPeriod"
            value={row.period}
            onChange={(event) => update(index, { period: event.target.value })}
            placeholder="Март 2021 — настоящее время"
            aria-label="Период работы"
            className={inputClass}
          />

          <textarea
            name="expDescription"
            value={row.description}
            onChange={(event) =>
              update(index, { description: event.target.value })
            }
            rows={3}
            placeholder="Обязанности и достижения"
            aria-label="Описание обязанностей"
            className={inputClass}
          />

          <button
            type="button"
            onClick={() => setRows((c) => c.filter((_, i) => i !== index))}
            className="inline-flex items-center gap-1.5 text-xs text-ink-soft transition hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            Удалить место работы
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setRows((c) => [...c, emptyExperience()])}
        className="inline-flex items-center gap-2 rounded-lg border border-muted px-3 py-2 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        Добавить место работы
      </button>
    </section>
  );
}

export function EducationEditor({ initial }: { initial: EducationRow[] }) {
  const [rows, setRows] = useState<EducationRow[]>(
    initial.length > 0 ? initial : [emptyEducation()],
  );

  const update = (index: number, patch: Partial<EducationRow>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium text-ink">Образование</h2>

      {rows.map((row, index) => (
        <div
          key={index}
          className="space-y-2 rounded-lg border border-muted bg-canvas p-3"
        >
          <input
            name="eduInstitution"
            value={row.institution}
            onChange={(event) =>
              update(index, { institution: event.target.value })
            }
            placeholder="Учебное заведение"
            aria-label="Учебное заведение"
            className={inputClass}
          />

          <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <input
              name="eduSpecialty"
              value={row.specialty}
              onChange={(event) =>
                update(index, { specialty: event.target.value })
              }
              placeholder="Специальность"
              aria-label="Специальность"
              className={inputClass}
            />
            <input
              name="eduYears"
              value={row.years}
              onChange={(event) => update(index, { years: event.target.value })}
              placeholder="2016"
              aria-label="Год окончания"
              className={inputClass}
            />
          </div>

          <button
            type="button"
            onClick={() => setRows((c) => c.filter((_, i) => i !== index))}
            className="inline-flex items-center gap-1.5 text-xs text-ink-soft transition hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            Удалить
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setRows((c) => [...c, emptyEducation()])}
        className="inline-flex items-center gap-2 rounded-lg border border-muted px-3 py-2 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        Добавить образование
      </button>
    </section>
  );
}
