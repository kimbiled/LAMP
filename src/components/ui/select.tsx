"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Выпадающий список вместо системного <select>.
//
// Системный список на Mac рисуется серым меню поверх страницы, в нём
// нельзя показать иконку или цвет, а выбранное значение подсвечивается
// как выделенный текст. Этот список выглядит одинаково везде: пункт
// с иконкой, галочка у выбранного, мягкая подсветка под мышью.
//
// Работает и с клавиатуры: стрелки, Enter, Esc, Home/End и первая
// буква пункта. В форму значение уходит скрытым полем name — поэтому
// его можно ставить в обычные формы вместо <select>.

export type SelectOption = {
  value: string;
  label: string;
  // Иконка слева. Только внутри клиентских компонентов: функцию нельзя
  // передать со страницы сервера.
  icon?: LucideIcon;
  // Цветная точка слева — для статусов, где важен цвет, а не значок.
  dot?: string;
  // Классы цвета иконки.
  tone?: string;
  hint?: string;
  // Фон и цвет текста самой кнопки, когда выбран этот пункт:
  // статус вакансии виден цветом, даже когда список закрыт.
  surface?: string;
  disabled?: boolean;
};

export function Select({
  value,
  defaultValue,
  options,
  onChange,
  name,
  id,
  label,
  placeholder = "Выберите",
  disabled,
  invalid,
  describedBy,
  className = "",
  buttonClassName = "",
}: {
  value?: string;
  defaultValue?: string;
  options: SelectOption[];
  onChange?: (next: string) => void;
  name?: string;
  id?: string;
  // Подпись для экранного диктора, если рядом нет <label>.
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [upward, setUpward] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const autoId = useId();
  const buttonId = id ?? `select-${autoId}`;
  const listId = `${buttonId}-list`;

  const selected = options.find((option) => option.value === current);

  // Закрываем по щелчку мимо списка.
  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Если снизу не хватает места — открываем вверх.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !listRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const height = listRef.current.offsetHeight;
    setUpward(window.innerHeight - rect.bottom < height + 12 && rect.top > height + 12);
  }, [open]);

  // Подсвеченный пункт всегда виден при прокрутке стрелками.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.children[active] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openList() {
    if (disabled) return;
    const index = options.findIndex((option) => option.value === current);
    setActive(index >= 0 ? index : 0);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    setOpen(false);
    buttonRef.current?.focus();
    if (option.value === current) return;
    if (value === undefined) setInner(option.value);
    onChange?.(option.value);
  }

  function move(step: number) {
    let next = active;
    for (let i = 0; i < options.length; i++) {
      next = (next + step + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActive(next);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(active);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        // Первая буква — прыжок к пункту, как в системном списке.
        if (event.key.length === 1) {
          const letter = event.key.toLowerCase();
          const found = options.findIndex(
            (option, index) =>
              index > active && option.label.toLowerCase().startsWith(letter),
          );
          const wrap = options.findIndex((option) =>
            option.label.toLowerCase().startsWith(letter),
          );
          const target = found >= 0 ? found : wrap;
          if (target >= 0) setActive(target);
        }
    }
  }

  const SelectedIcon = selected?.icon;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={[
          "flex h-10 w-full items-center gap-2 rounded-lg border pr-2.5 pl-3 text-left text-sm transition",
          selected?.surface ?? "bg-surface text-ink",
          "hover:border-ink-soft focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-accent/40 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-soft",
          invalid ? "border-danger" : open ? "border-ink" : "border-line-strong",
          buttonClassName,
        ].join(" ")}
      >
        {selected?.dot && (
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${selected.dot}`} />
        )}
        {SelectedIcon && (
          <SelectedIcon
            aria-hidden
            className={`h-4 w-4 shrink-0 ${selected?.tone ?? "text-ink-soft"}`}
            strokeWidth={2}
          />
        )}
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-ink-faint"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-ink-soft transition ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
          className={[
            "absolute left-0 z-40 max-h-72 min-w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg shadow-ink/10",
            upward ? "bottom-full mb-1" : "top-full mt-1",
          ].join(" ")}
        >
          {options.map((option, index) => {
            const Icon = option.icon;
            const isSelected = option.value === current;
            const isActive = index === active;
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
                className={[
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm whitespace-nowrap",
                  option.disabled ? "cursor-not-allowed opacity-50" : "",
                  isSelected ? "bg-glow font-medium text-ink" : isActive ? "bg-muted text-ink" : "text-ink",
                ].join(" ")}
              >
                {option.dot && (
                  <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${option.dot}`} />
                )}
                {Icon && (
                  <Icon
                    aria-hidden
                    className={`h-4 w-4 shrink-0 ${option.tone ?? "text-ink-soft"}`}
                    strokeWidth={2}
                  />
                )}
                <span className="flex-1">
                  {option.label}
                  {option.hint && (
                    <span className="block text-xs font-normal text-ink-soft">{option.hint}</span>
                  )}
                </span>
                <Check
                  aria-hidden
                  className={`h-4 w-4 shrink-0 text-ink ${isSelected ? "" : "invisible"}`}
                  strokeWidth={2.2}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
