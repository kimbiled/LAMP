"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createUser, type UserFormState } from "@/app/actions/users";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: UserFormState = {};

export function NewUserForm() {
  const [state, formAction] = useActionState(createUser, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.formError && (
        <div className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {state.formError}
        </div>
      )}

      <TextField
        label="Имя и фамилия"
        name="fullName"
        required
        placeholder="Мария Иванова"
        defaultValue={state.values?.fullName}
        error={state.fieldErrors?.fullName}
      />

      <TextField
        label="Рабочая почта"
        name="email"
        type="email"
        required
        placeholder="maria@company.ru"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />

      <div>
        <label
          htmlFor="field-role"
          className="block text-sm font-medium text-ink"
        >
          Роль
        </label>
        <select
          id="field-role"
          name="role"
          defaultValue={state.values?.role ?? "RECRUITER"}
          className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-accent"
        >
          <option value="RECRUITER">Рекрутер</option>
          <option value="HIRING_MANAGER">Нанимающий менеджер</option>
          <option value="ADMIN">Администратор</option>
        </select>
        {state.fieldErrors?.role && (
          <p className="mt-1.5 text-xs text-danger">
            {state.fieldErrors.role}
          </p>
        )}
      </div>

      <TextField
        label="Временный пароль"
        name="password"
        type="text"
        required
        hint="Не короче 8 символов. Передайте его сотруднику — он сможет войти сразу"
        error={state.fieldErrors?.password}
      />

      <div className="flex gap-3 pt-1">
        <Link
          href="/users"
          className="flex-1 rounded-lg border border-line-strong px-4 py-2.5 text-center text-sm text-ink transition hover:bg-canvas"
        >
          Отмена
        </Link>
        <div className="flex-1">
          <SubmitButton pendingLabel="Создаём…">Создать</SubmitButton>
        </div>
      </div>
    </form>
  );
}
