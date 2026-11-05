"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { deleteCompany, type SystemFormState } from "@/app/actions/system";

// Красная кнопка отправки: пока идёт удаление, нажать второй раз нельзя.
function DangerSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-danger px-4 py-2.5 text-sm font-medium text-white transition hover:bg-danger-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Удаляем…" : "Удалить компанию навсегда"}
    </button>
  );
}

// Удаление компании целиком. Вместе с ней исчезают её пользователи,
// вакансии, кандидаты, резюме и история — восстановить нельзя.
// Поэтому название компании нужно ввести вручную.

const initialState: SystemFormState = {};

export function DeleteCompanyForm({
  companyId,
  companyName,
  users,
  candidates,
}: {
  companyId: string;
  companyName: string;
  users: number;
  candidates: number;
}) {
  const [open, setOpen] = useState(false);
  // После успешного удаления сервер сам уводит на список компаний,
  // поэтому здесь остаётся обрабатывать только ошибки.
  const [state, formAction] = useActionState(deleteCompany, initialState);

  return (
    <section className="mt-5 rounded-xl border border-danger-line bg-danger-soft/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-medium text-danger">
          <AlertTriangle className="h-4 w-4" strokeWidth={1.8} />
          Удалить компанию
        </h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg border border-danger-line bg-surface px-3 py-1.5 text-sm text-danger transition hover:border-danger"
        >
          {open ? "Свернуть" : "Открыть"}
        </button>
      </div>

      <p className="mt-2 text-xs text-ink-soft">
        Вместе с компанией удалятся {users} учётных записей, {candidates}{" "}
        кандидатов, все вакансии, резюме, интервью и история. Восстановить это
        будет нельзя.
      </p>

      {open && (
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="companyId" value={companyId} />

          {state.formError && (
            <div className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger">
              {state.formError}
            </div>
          )}

          <div>
            <label
              htmlFor="field-confirmation"
              className="block text-sm font-medium text-ink"
            >
              Введите название компании, чтобы подтвердить
            </label>
            <input
              id="field-confirmation"
              name="confirmation"
              required
              autoComplete="off"
              placeholder={companyName}
              className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-danger focus:ring-2 focus:ring-danger-line"
            />
          </div>

          <div className="sm:w-56">
            <DangerSubmit />
          </div>
        </form>
      )}
    </section>
  );
}
