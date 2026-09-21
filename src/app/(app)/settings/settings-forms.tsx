"use client";

import { useActionState } from "react";
import {
  changeOwnPassword,
  updateCompany,
  updateOwnProfile,
  type SettingsFormState,
} from "@/app/actions/settings";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: SettingsFormState = {};

function Message({ state }: { state: SettingsFormState }) {
  if (state.formError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
        {state.formError}
      </div>
    );
  }
  if (state.success) {
    return (
      <div className="rounded-lg border border-muted bg-muted px-3 py-2.5 text-sm text-ink">
        {state.success}
      </div>
    );
  }
  return null;
}

export function CompanyForm({ name }: { name: string }) {
  const [state, formAction] = useActionState(updateCompany, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Message state={state} />

      <TextField
        label="Название компании"
        name="name"
        required
        defaultValue={name}
        error={state.fieldErrors?.name}
      />

      <div className="sm:w-48">
        <SubmitButton pendingLabel="Сохраняем…">Сохранить</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changeOwnPassword, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Message state={state} />

      <TextField
        label="Текущий пароль"
        name="currentPassword"
        type="password"
        required
        autoComplete="current-password"
        error={state.fieldErrors?.currentPassword}
      />

      <TextField
        label="Новый пароль"
        name="newPassword"
        type="password"
        required
        autoComplete="new-password"
        hint="Не короче 8 символов"
        error={state.fieldErrors?.newPassword}
      />

      <TextField
        label="Повторите новый пароль"
        name="newPasswordConfirm"
        type="password"
        required
        autoComplete="new-password"
        error={state.fieldErrors?.newPasswordConfirm}
      />

      <div className="sm:w-48">
        <SubmitButton pendingLabel="Меняем…">Изменить пароль</SubmitButton>
      </div>
    </form>
  );
}

export function ProfileForm({
  fullName,
  position,
}: {
  fullName: string;
  position: string;
}) {
  const [state, formAction] = useActionState(updateOwnProfile, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Message state={state} />

      <TextField
        label="Имя и фамилия"
        name="fullName"
        required
        defaultValue={fullName}
        error={state.fieldErrors?.fullName}
      />

      <TextField
        label="Должность"
        name="position"
        placeholder="Руководитель отдела маркетинга"
        hint="Видна коллегам рядом с вашими фидбэками по кандидатам"
        defaultValue={position}
        error={state.fieldErrors?.position}
      />

      <div className="sm:w-48">
        <SubmitButton pendingLabel="Сохраняем…">Сохранить</SubmitButton>
      </div>
    </form>
  );
}
