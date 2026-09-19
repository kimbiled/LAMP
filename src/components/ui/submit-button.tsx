"use client";

import { useFormStatus } from "react-dom";

// Кнопка отправки формы. Пока форма обрабатывается на сервере,
// кнопка блокируется и меняет надпись — чтобы не нажали дважды.

export function SubmitButton({
  children,
  pendingLabel = "Подождите…",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
