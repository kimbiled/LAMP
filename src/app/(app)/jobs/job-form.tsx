"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { JobFormState } from "@/app/actions/jobs";
import type { Role } from "@/generated/prisma/enums";
import { TextField } from "@/components/ui/text-field";
import { SelectField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { CURRENCIES, ROLE_LABELS } from "@/lib/labels";

const initialState: JobFormState = {};

export type JobFormValues = {
  title: string;
  description: string;
  requirements: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  status: string;
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
  action: (
    state: JobFormState,
    formData: FormData,
  ) => Promise<JobFormState>;
  users: { id: string; fullName: string; role: Role }[];
  values: JobFormValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

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
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {state.formError}
        </div>
      )}

      <TextField
        label="Название вакансии"
        name="title"
        required
        placeholder="Менеджер по продажам"
        defaultValue={values.title}
        error={state.fieldErrors?.title}
      />

      <TextareaField
        label="Описание"
        name="description"
        rows={5}
        placeholder="Чем предстоит заниматься"
        defaultValue={values.description}
        error={state.fieldErrors?.description}
      />

      <TextareaField
        label="Требования"
        name="requirements"
        rows={5}
        placeholder="Опыт, навыки, образование"
        defaultValue={values.requirements}
        error={state.fieldErrors?.requirements}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Зарплата от"
          name="salaryMin"
          type="number"
          placeholder="500000"
          defaultValue={values.salaryMin}
          error={state.fieldErrors?.salaryMin}
        />
        <TextField
          label="Зарплата до"
          name="salaryMax"
          type="number"
          placeholder="800000"
          defaultValue={values.salaryMax}
          error={state.fieldErrors?.salaryMax}
        />
        <SelectField
          label="Валюта"
          name="currency"
          defaultValue={values.currency}
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
          defaultValue={values.recruiterId}
          options={peopleOptions}
          hint="Кто ведёт подбор"
        />
        <SelectField
          label="Нанимающий менеджер"
          name="hiringManagerId"
          defaultValue={values.hiringManagerId}
          options={peopleOptions}
          hint="Увидит только эту вакансию и её кандидатов"
        />
      </div>

      <SelectField
        label="Статус"
        name="status"
        defaultValue={values.status}
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
          className="flex-1 rounded-lg border border-muted px-4 py-2.5 text-center text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink sm:flex-none sm:px-8"
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
