"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { CandidateFormState } from "@/app/actions/candidates";
import { TextField } from "@/components/ui/text-field";
import { SelectField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { CURRENCIES } from "@/lib/labels";
import {
  EducationEditor,
  ExperienceEditor,
  type EducationRow,
  type ExperienceRow,
} from "./experience-editor";

const initialState: CandidateFormState = {};

export type CandidateFormValues = {
  fullName: string;
  jobId: string;
  stageId: string;
  phone: string;
  email: string;
  city: string;
  birthDate: string;
  currentPosition: string;
  experienceYears: string;
  salaryExpectation: string;
  currency: string;
  telegram: string;
  skills: string;
  languages: string;
  source: string;
  note: string;
};

export function CandidateForm({
  action,
  jobs,
  stages,
  values,
  experience,
  education,
  submitLabel,
  cancelHref,
}: {
  action: (
    state: CandidateFormState,
    formData: FormData,
  ) => Promise<CandidateFormState>;
  jobs: { id: string; title: string }[];
  stages: { id: string; name: string }[];
  values: CandidateFormValues;
  experience: ExperienceRow[];
  education: EducationRow[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {state.formError}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-ink">Основное</h2>

        <TextField
          label="ФИО"
          name="fullName"
          required
          placeholder="Петров Иван Сергеевич"
          hint="Фамилия, имя, отчество"
          defaultValue={values.fullName}
          error={state.fieldErrors?.fullName}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Вакансия"
            name="jobId"
            defaultValue={values.jobId}
            options={[
              { value: "", label: "Без вакансии" },
              ...jobs.map((job) => ({ value: job.id, label: job.title })),
            ]}
          />
          <SelectField
            label="Этап"
            name="stageId"
            defaultValue={values.stageId}
            options={stages.map((stage) => ({
              value: stage.id,
              label: stage.name,
            }))}
            error={state.fieldErrors?.stageId}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-ink">Контакты</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Телефон"
            name="phone"
            type="tel"
            placeholder="+7 701 123 45 67"
            hint="Нужен для кнопок «Позвонить» и WhatsApp"
            defaultValue={values.phone}
            error={state.fieldErrors?.phone}
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            placeholder="ivan@mail.kz"
            defaultValue={values.email}
            error={state.fieldErrors?.email}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Telegram"
            name="telegram"
            placeholder="@ivan_petrov"
            hint="Можно с @ или ссылкой — приведём к единому виду"
            defaultValue={values.telegram}
            error={state.fieldErrors?.telegram}
          />
          <TextField
            label="Город"
            name="city"
            placeholder="Астана"
            defaultValue={values.city}
            error={state.fieldErrors?.city}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Дата рождения"
            name="birthDate"
            type="date"
            defaultValue={values.birthDate}
            error={state.fieldErrors?.birthDate}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-ink">Профиль</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Текущая должность"
            name="currentPosition"
            placeholder="Frontend-разработчик"
            defaultValue={values.currentPosition}
            error={state.fieldErrors?.currentPosition}
          />
          <TextField
            label="Опыт работы, лет"
            name="experienceYears"
            type="number"
            placeholder="5"
            defaultValue={values.experienceYears}
            error={state.fieldErrors?.experienceYears}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Зарплатные ожидания"
            name="salaryExpectation"
            type="number"
            placeholder="900000"
            defaultValue={values.salaryExpectation}
            error={state.fieldErrors?.salaryExpectation}
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

        <TextField
          label="Навыки"
          name="skills"
          placeholder="React, TypeScript, Figma"
          hint="Через запятую"
          defaultValue={values.skills}
        />

        <TextField
          label="Языки"
          name="languages"
          placeholder="Русский, английский B2"
          hint="Через запятую"
          defaultValue={values.languages}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Источник"
            name="source"
            placeholder="Рекомендация, сайт, HeadHunter"
            defaultValue={values.source}
            error={state.fieldErrors?.source}
          />
        </div>

        <TextareaField
          label="Комментарий"
          name="note"
          rows={4}
          placeholder="Заметки для команды"
          defaultValue={values.note}
          error={state.fieldErrors?.note}
        />
      </section>

      <ExperienceEditor initial={experience} />

      <EducationEditor initial={education} />

      <div className="flex gap-3">
        <Link
          href={cancelHref}
          className="flex-1 rounded-lg border border-muted px-4 py-2.5 text-center text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink sm:flex-none sm:px-8"
        >
          Отмена
        </Link>
        <div className="flex-1 sm:w-48 sm:flex-none">
          <SubmitButton pendingLabel="Сохраняем…">{submitLabel}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
