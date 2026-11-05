"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import { buttonClass } from "./styles";

// Окна поверх страницы.
//
// Сделаны на встроенном в браузер элементе <dialog>: он сам закрывается
// по Esc, держит фокус внутри окна, затемняет фон и сообщает экранному
// диктору, что открылось окно. Раньше окна были обычными блоками div —
// без этого всего.

// ---------- Обычное окно ----------

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Клик по затемнённому фону закрывает окно.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
      className={`m-auto w-[calc(100%-2rem)] ${width} rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40`}
    >
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть окно"
              className={buttonClass({ variant: "ghost", size: "icon-sm", className: "-mr-1 -mt-1" })}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// ---------- Подтверждение действия ----------
//
// Вместо системного window.confirm (серое окно браузера на английском
// в Chrome у части пользователей):
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "Удалить кандидата?", danger: true }))) return;

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Опасное действие: красная кнопка подтверждения.
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    // Если окно уже открыто, прежний вопрос считаем отменённым.
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={options !== null}
        onClose={() => finish(false)}
        title={options?.title ?? ""}
        size="sm"
      >
        {options?.message && (
          <p className="text-sm text-ink-soft">{options.message}</p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={() => finish(false)}
            className={buttonClass({ variant: "secondary" })}
          >
            {options?.cancelLabel ?? "Отмена"}
          </button>
          <button
            type="button"
            onClick={() => finish(true)}
            className={buttonClass({ variant: options?.danger ? "danger" : "primary" })}
          >
            {options?.confirmLabel ?? "Подтвердить"}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  // Вне провайдера (например, на гостевой странице) — системное окно,
  // чтобы действие всё равно спрашивало подтверждение.
  return (
    confirm ??
    (async (options) =>
      window.confirm(
        [options.title, options.message].filter(Boolean).join("\n\n"),
      ))
  );
}
