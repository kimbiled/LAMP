"use client";

import { useState } from "react";
import { ExternalLink, Link2, Video } from "lucide-react";
import { NEW_GOOGLE_MEET_URL } from "@/lib/meeting";

// Поле «Ссылка на встречу» в форме интервью.
//
// Две подсказки рядом:
//  • «Создать в Google Meet» — открывает новую встречу в Google
//    в соседней вкладке; ссылку оттуда копируют и вставляют сюда.
//  • «Постоянная ссылка компании» — комната из настроек, одним нажатием.
// К Google по API не обращаемся: всё делает сам человек в браузере.

const hintClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink transition hover:border-ink-soft";

export function MeetingUrlField({
  defaultValue,
  companyLink,
  error,
  id = "meetingUrl",
}: {
  defaultValue: string;
  companyLink: string | null;
  error?: string;
  id?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        Ссылка на встречу
      </label>
      <input
        id={id}
        name="meetingUrl"
        type="text"
        inputMode="url"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="https://meet.google.com/abc-defg-hij"
        aria-invalid={error ? true : undefined}
        className={`mt-1.5 w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-accent ${
          error ? "border-danger-line" : "border-line-strong"
        }`}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={NEW_GOOGLE_MEET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={hintClass}
        >
          <Video className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
          Создать в Google Meet
          <ExternalLink className="h-3 w-3 text-ink-soft" strokeWidth={1.8} aria-hidden />
        </a>

        {companyLink && value.trim() !== companyLink && (
          <button
            type="button"
            onClick={() => setValue(companyLink)}
            className={hintClass}
          >
            <Link2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            Постоянная ссылка компании
          </button>
        )}
      </div>
    </div>
  );
}

// Кнопка «Подключиться» у назначенной встречи.
export function JoinMeetingLink({ url }: { url: string | null }) {
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-accent-hover"
    >
      <Video className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
      Подключиться
    </a>
  );
}
