"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./styles";

// Кнопка отправки формы. Пока форма обрабатывается на сервере,
// кнопка блокируется, крутит значок и меняет надпись — чтобы не нажали дважды.
//
// По умолчанию — главная жёлтая кнопка на всю ширину (как на входе и регистрации).
// В строке действий передавайте full={false}: тогда кнопка по размеру текста.

export function SubmitButton({
  children,
  pendingLabel = "Подождите…",
  variant = "primary",
  size = "md",
  full = true,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={buttonClass({ variant, size, full, className })}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </button>
  );
}
