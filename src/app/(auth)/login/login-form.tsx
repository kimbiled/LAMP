"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthFormState } from "@/app/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: AuthFormState = {};

export function LoginForm() {
  // useActionState связывает форму с серверным действием
  // и хранит ответ сервера (ошибки, введённые значения).
  const [state, formAction] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink-strong">Вход в LAMP</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Войдите в рабочее пространство своей компании
        </p>
      </div>

      {state.formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {state.formError}
        </div>
      )}

      <TextField
        label="Рабочая почта"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="ivan@company.ru"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />

      <TextField
        label="Пароль"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />

      <div className="pt-1">
        <SubmitButton pendingLabel="Входим…">Войти</SubmitButton>
      </div>

      <p className="pt-2 text-center text-sm text-ink-soft">
        Нет аккаунта?{" "}
        <Link href="/register" className="font-medium text-ink underline">
          Зарегистрировать компанию
        </Link>
      </p>
    </form>
  );
}
