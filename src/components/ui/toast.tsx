"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

// Короткие сообщения в углу экрана: «Этап изменён», «Не удалось сохранить».
//
// Раньше быстрые действия (смена этапа, роли, статуса вакансии) ничего
// не сообщали: человек не понимал, сохранилось ли. При сбое выбор молча
// откатывался. Теперь каждое такое действие говорит о результате.
//
//   const toast = useToast();
//   toast.success("Этап изменён");
//   toast.error(NETWORK_ERROR);

type Tone = "success" | "error";
type Item = { id: number; tone: Tone; message: string };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((item) => item.id !== id));
  }, []);

  const api = useMemo<ToastApi>(() => {
    const push = (tone: Tone, message: string) => {
      const id = nextId++;
      setItems((list) => [...list.slice(-2), { id, tone, message }]);
      // Ошибку держим дольше: её надо успеть прочитать.
      setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4000);
    };
    return {
      success: (message) => push("success", message),
      error: (message) => push("error", message),
    };
  }, [dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* aria-live: экранный диктор зачитает сообщение сам. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
              item.tone === "error"
                ? "border-danger-line bg-danger-soft text-danger-ink"
                : "border-success-line bg-surface text-ink"
            }`}
          >
            {item.tone === "error" ? (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
            ) : (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            )}
            <span className="flex-1">{item.message}</span>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Закрыть сообщение"
              className="-m-1 rounded-md p-1 text-ink-soft hover:bg-muted hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Вне провайдера сообщения просто не показываются — без падения.
const SILENT: ToastApi = { success: () => {}, error: () => {} };

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? SILENT;
}

export const NETWORK_ERROR =
  "Не удалось сохранить. Проверьте интернет и попробуйте ещё раз";
