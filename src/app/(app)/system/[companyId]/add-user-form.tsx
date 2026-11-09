"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import {
  createUserInCompany,
  type SystemFormState,
} from "@/app/actions/system";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";

// Добавление сотрудника в любую компанию — форма владельца системы.
// Компания берётся не из полей формы, а из адреса страницы,
// и на сервере проверяется, что такая компания существует.

const initialState: SystemFormState = {};

export function AddUserForm({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    createUserInCompany.bind(null, companyId),
    initialState,
  );

  return (
    <section className="mt-5 rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink-strong">
          Добавить пользователя
        </h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink transition hover:bg-canvas"
        >
          <UserPlus className="h-4 w-4" strokeWidth={1.8} />
          {open ? "Свернуть" : "Открыть форму"}
        </button>
      </div>

      <p className="mt-2 text-xs text-ink-soft">
        Человек попадёт в компанию «{companyName}» и сможет войти сразу с тем
        паролем, который вы зададите.
      </p>

      {state.okMessage && (
        <p className="mt-3 rounded-lg border border-khaki-line bg-khaki-soft px-3 py-2 text-sm text-khaki-ink">
          {state.okMessage}
        </p>
      )}

      {open && (
        <form
          action={formAction}
          className="mt-4 space-y-4 rounded-lg border border-line bg-canvas p-4"
        >
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
            placeholder="maria@company.kz"
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
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-ink focus:ring-[3px] focus:ring-accent/40"
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
            hint="Не короче 8 символов. Передайте его сотруднику"
            error={state.fieldErrors?.password}
          />

          <div className="sm:w-48">
            <SubmitButton pendingLabel="Создаём…">Создать</SubmitButton>
          </div>
        </form>
      )}
    </section>
  );
}
