"use client";

import { useRef } from "react";
import { useConfirm } from "./dialog";

// Обычная форма с действием на сервере, которая перед отправкой
// спрашивает подтверждение в окне Skillo. Для простых опасных кнопок:
// отменить встречу, отозвать ссылку.
//
//   <ConfirmForm action={revokeShareLink} confirm={{ title: "Отозвать ссылку?", danger: true }}>
//     <input type="hidden" name="linkId" value={id} />
//     <button type="submit">Отозвать</button>
//   </ConfirmForm>

export function ConfirmForm({
  action,
  confirm: options,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  confirm: {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  };
  children: React.ReactNode;
  className?: string;
}) {
  const confirm = useConfirm();
  const approved = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      action={action}
      className={className}
      onSubmit={async (event) => {
        if (approved.current) {
          approved.current = false;
          return;
        }
        event.preventDefault();
        if (await confirm(options)) {
          approved.current = true;
          form.current?.requestSubmit();
        }
      }}
    >
      {children}
    </form>
  );
}
