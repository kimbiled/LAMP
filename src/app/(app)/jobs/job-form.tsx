"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { JobFormState } from "@/app/actions/jobs";
import type { Role } from "@/generated/prisma/enums";
import { TextField } from "@/components/ui/text-field";
import { SelectField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { CURRENCIES, ROLE_LABELS } from "@/lib/labels";
import { JOB_PRIORITIES, jobPriority } from "@/lib/job-priority";

const initialState: JobFormState = {};

export type JobFormValues = {
  title: string;
  description: string;
  requirements: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  status: string;
  priority: string;
  recruiterId: string;
  hiringManagerId: string;
};

export function JobForm({
  action,
  users,
  values,
  submitLabel,
  cancelHref,
}: {
  action: (state: JobFormState, formData: FormData) => Promise<JobFormState>;
  users: { id: string; fullName: string; role: Role }[];
  values: JobFormValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  // После ошибки показываем то, что человек ввёл, а не исходные значения:
  // иначе React 19 сбрасывает форму и набранный текст пропадает.
  const current: JobFormValues = state.values
    ? { ...values, ...state.values }
    : values;

  const [priority, setPriority] = useState(values.priority);

  const chosen = jobPriority(
    priority as (typeof JOB_PRIORITIES)[number]["value"],
  );

  const peopleOptions = [
    { value: "", label: "Не назначен" },
    ...users.map((user) => ({
      value: user.id,
      label: `${user.fullName} · ${ROLE_LABELS[user.role]}`,
    })),
  ];

  return (
    <form action={formAction} className="space-y-4">
      {state.formError && (
        <div role="alert" className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger-ink">
          {state.formError}
        </div>
      )}

      <TextField
        label="Название вакансии"
        name="title"
        required
        placeholder="Менеджер по продажам"
        defaultValue={current.title}
        error={state.fieldErrors?.title}
      />

      {/* Приоритет сразу под названием: это решение принимают вместе
          с решением открыть вакансию, а не в конце заполнения формы.

          Кнопками, а не списком: три варианта в выпадающем списке —
          это два лишних нажатия, и выбранное значение не видно,
          пока список закрыт. Значение уходит скрытым полем. */}
      <div>
        <p className="text-sm text-ink">Приоритет</p>

        <input type="hidden" name="priority" value={priority} />

        <div className="mt-1.5 flex flex-wrap gap-2">
          {JOB_PRIORITIES.map((item) => {
            const Icon = item.icon;
            const isChosen = priority === item.value;

            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={isChosen}
                onClick={() => setPriority(item.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
                  isChosen
                    ? item.active
                    : "border-line text-ink-soft hover:border-ink-soft hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Подсказка меняется вместе с выбором: словами, что именно
            обещает выбранный приоритет. */}
        <p className="mt-1.5 text-xs text-ink-soft">
          {chosen
            ? `${chosen.label} — ${chosen.hint}`
            : "Высокие вакансии показываются в списке первыми"}
        </p>

        {state.fieldErrors?.priority && (
          <p className="mt-1.5 text-xs text-danger">
            {state.fieldErrors.priority}
          </p>
        )}
      </div>

      <TextareaField
        label="Описание"
        name="description"
        rows={5}
        placeholder="Чем предстоит заниматься"
        defaultValue={current.description}
        error={state.fieldErrors?.description}
      />

      <TextareaField
        label="Требования"
        name="requirements"
        rows={5}
        placeholder="Опыт, навыки, образование"
        defaultValue={current.requirements}
        error={state.fieldErrors?.requirements}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Зарплата от"
          name="salaryMin"
          type="number"
          placeholder="500000"
          defaultValue={current.salaryMin}
          error={state.fieldErrors?.salaryMin}
        />
        <TextField
          label="Зарплата до"
          name="salaryMax"
          type="number"
          placeholder="800000"
          defaultValue={current.salaryMax}
          error={state.fieldErrors?.salaryMax}
        />
        <SelectField
          label="Валюта"
          name="currency"
          defaultValue={current.currency}
          options={CURRENCIES.map((item) => ({
            value: item.code,
            label: item.label,
          }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Рекрутер"
          name="recruiterId"
          defaultValue={current.recruiterId}
          options={peopleOptions}
          hint="Кто ведёт подбор"
        />
        <SelectField
          label="Нанимающий менеджер"
          name="hiringManagerId"
          defaultValue={current.hiringManagerId}
          options={peopleOptions}
          hint="Увидит только эту вакансию и её кандидатов"
        />
      </div>

      <SelectField
        label="Статус"
        name="status"
        defaultValue={current.status}
        options={[
          { value: "OPEN", label: "Открыта" },
          { value: "PAUSED", label: "Приостановлена" },
          { value: "CLOSED", label: "Закрыта" },
        ]}
        error={state.fieldErrors?.status}
      />

      <div className="flex gap-3 pt-2">
        <Link
          href={cancelHref}
          className="flex-1 rounded-lg border border-line-strong px-4 py-2.5 text-center text-sm text-ink transition hover:bg-canvas sm:flex-none sm:px-8"
        >
          Отмена
        </Link>
        <div className="flex-1 sm:flex-none sm:w-48">
          <SubmitButton pendingLabel="Сохраняем…">{submitLabel}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
