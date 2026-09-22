"use client";

import { useRef } from "react";
import { Video } from "lucide-react";

// Кнопка «Вставить ссылку на встречу».
//
// Постоянная комната компании задаётся один раз в настройках, а здесь
// подставляется в поле одним нажатием. Никаких обращений к Google:
// ссылка просто хранится у компании и вставляется как текст.
//
// Кнопка дописывает ссылку к тому, что уже набрано, а не затирает —
// в комментарии часто стоит что-то ещё, например адрес офиса.

export function MeetingLinkButton({
  link,
  target,
}: {
  link: string | null;
  // Поле, куда вставлять: имя элемента формы.
  target: string;
}) {
  const wrapper = useRef<HTMLDivElement>(null);

  if (!link) return null;

  function insert() {
    const form = wrapper.current?.closest("form");
    const field = form?.elements.namedItem(target);

    if (
      !(field instanceof HTMLTextAreaElement) &&
      !(field instanceof HTMLInputElement)
    ) {
      return;
    }

    if (field.value.includes(link!)) return;

    const setValue = Object.getOwnPropertyDescriptor(
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )?.set;

    const next = field.value.trim() ? `${field.value.trim()}\n${link}` : link!;

    // Значение ставим через родной установщик: иначе React не заметит
    // изменения и при отправке формы уйдёт старое содержимое.
    setValue?.call(field, next);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
  }

  return (
    <div ref={wrapper}>
      <button
        type="button"
        onClick={insert}
        className="inline-flex items-center gap-1.5 rounded-lg border border-muted bg-surface px-3 py-1.5 text-xs text-ink transition hover:border-ink-soft"
      >
        <Video className="h-3.5 w-3.5" strokeWidth={1.8} />
        Вставить ссылку на встречу
      </button>
    </div>
  );
}
