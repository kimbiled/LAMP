"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerCompany, type AuthFormState } from "@/app/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: AuthFormState = {};

export function RegisterForm() {
  const [state, formAction] = useActionState(registerCompany, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink-strong">
          Регистрация компании
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Вы станете администратором рабочего пространства
        </p>
      </div>

      {state.formError && (
        <div className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {state.formError}
        </div>
      )}

      <TextField
        label="Название компании"
        name="companyName"
        required
        placeholder="ООО Ромашка"
        defaultValue={state.values?.companyName}
        error={state.fieldErrors?.companyName}
      />

      <TextField
        label="Ваше имя и фамилия"
        name="fullName"
        required
        autoComplete="name"
        placeholder="Иван Петров"
        defaultValue={state.values?.fullName}
        error={state.fieldErrors?.fullName}
      />

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
        autoComplete="new-password"
        hint="Не короче 8 символов"
        error={state.fieldErrors?.password}
      />

      <TextField
        label="Повторите пароль"
        name="passwordConfirm"
        type="password"
        required
        autoComplete="new-password"
        error={state.fieldErrors?.passwordConfirm}
      />

      <div className="pt-1">
        <SubmitButton pendingLabel="Создаём…">Создать компанию</SubmitButton>
      </div>

      <p className="pt-2 text-center text-sm text-ink-soft">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-medium text-ink underline">
          Войти
        </Link>
      </p>
    </form>
  );
}
