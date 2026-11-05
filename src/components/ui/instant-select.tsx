"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import { useConfirm } from "./dialog";
import { NETWORK_ERROR, useToast } from "./toast";
import { inputClass } from "./styles";

// Выпадающий список, который сохраняет выбор сразу, без кнопки «Сохранить»:
// роль сотрудника, статус и приоритет вакансии.
//
// Что он делает сверх обычного списка:
//   — спрашивает подтверждение, если передан confirmText (например, роль);
//   — сообщает результат: «Роль изменена» или текст ошибки;
//   — при ошибке возвращает прежнее значение, а не делает вид,
//     что всё сохранилось.

export function InstantSelect({
  value,
  options,
  action,
  buildForm,
  label,
  confirmText,
  disabled,
  className = "",
}: {
  value: string;
  options: { value: string; label: string }[];
  action: (formData: FormData) => Promise<ActionResult>;
  // Поля формы для действия: id записи и новое значение.
  buildForm: (next: string) => Record<string, string>;
  label: string;
  // Если задано — перед сохранением спросить подтверждение.
  confirmText?: (nextLabel: string) => { title: string; message?: string };
  disabled?: boolean;
  className?: string;
}) {
  const [current, setCurrent] = useState(value);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();

  async function change(next: string) {
    if (next === current) return;
    const nextLabel = options.find((option) => option.value === next)?.label ?? next;

    if (confirmText) {
      const text = confirmText(nextLabel);
      const confirmed = await confirm({ ...text, confirmLabel: "Изменить" });
      if (!confirmed) return;
    }

    const previous = current;
    setCurrent(next);

    const formData = new FormData();
    for (const [key, field] of Object.entries(buildForm(next))) {
      formData.set(key, field);
    }

    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result.ok) {
          if (result.message) toast.success(result.message);
        } else {
          setCurrent(previous);
          toast.error(result.error);
        }
      } catch {
        setCurrent(previous);
        toast.error(NETWORK_ERROR);
      }
    });
  }

  return (
    <select
      value={current}
      disabled={disabled || pending}
      aria-label={label}
      aria-busy={pending || undefined}
      onChange={(event) => change(event.target.value)}
      className={inputClass(false, `w-auto ${className}`)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
