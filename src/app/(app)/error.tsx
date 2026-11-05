"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert, RotateCcw } from "lucide-react";
import { buttonClass } from "@/components/ui/styles";

// Что видит человек, если страница сломалась на сервере (база недоступна,
// пропал интернет и т. п.). Без этого файла Next показывал английский
// технический экран, и было непонятно, что делать.
//
// В Next 16 повторная попытка называется retry (раньше было reset).

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <CircleAlert className="mx-auto h-10 w-10 text-danger" strokeWidth={1.6} aria-hidden />
      <h1 className="mt-4 text-xl font-semibold text-ink-strong">
        Не получилось открыть страницу
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Скорее всего, пропала связь с сервером. Проверьте интернет и попробуйте
        ещё раз. Если не помогает — сообщите администратору
        {error.digest ? `, код ошибки: ${error.digest}` : ""}.
      </p>
      <div className="mt-6 flex flex-col-reverse justify-center gap-3 sm:flex-row">
        <Link href="/dashboard" className={buttonClass({ variant: "secondary" })}>
          На главную
        </Link>
        <button type="button" onClick={retry} className={buttonClass({ variant: "primary" })}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Попробовать ещё раз
        </button>
      </div>
    </div>
  );
}
