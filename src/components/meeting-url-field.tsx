"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Settings2, Video } from "lucide-react";
import { NEW_GOOGLE_MEET_URL } from "@/lib/meeting";
import { fillInviteTemplate } from "@/lib/invite-template";
import { saveMyMeetingLink } from "@/app/actions/settings";
import { useMeetingDefaults } from "@/components/meeting-defaults";
import { Modal } from "@/components/ui/dialog";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { NETWORK_ERROR, useToast } from "@/components/ui/toast";

// Поле «Ссылка на встречу» в форме интервью.
//
// Кнопка «Google Meet»:
//  • если у человека уже есть постоянная комната — подставляет её;
//  • если нет — открывает окно: создать комнату в Google (новая вкладка),
//    вставить ссылку и сохранить её как свою. Это делается один раз,
//    дальше кнопка просто подставляет ссылку. Изменить её можно
//    в «Настройках».
//
// Кнопка «Скопировать приглашение» собирает текст по шаблону из
// настроек: имя, вакансия, дата, время и ссылка — и кладёт его
// в буфер обмена, чтобы вставить в WhatsApp или Telegram.
//
// К Google по API не обращаемся: всё делает сам человек в браузере.

const hintClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink transition hover:border-ink-soft";

const DURATION_TEXT: Record<string, string> = {
  "30": "30 минут",
  "45": "45 минут",
  "60": "1 час",
  "90": "1,5 часа",
  "120": "2 часа",
};

// «2026-11-12» → «12 ноября, четверг». Полдень по UTC — чтобы
// часовой пояс браузера не сдвинул дату на соседний день.
function humanDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T12:00:00Z`);
  const day = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
  const weekday = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
  return `${day}, ${weekday}`;
}

function formValue(form: HTMLFormElement | null, name: string): string {
  const field = form?.elements.namedItem(name);
  return field && "value" in field ? String((field as { value: unknown }).value) : "";
}

export function MeetingUrlField({
  defaultValue,
  companyLink,
  candidateName,
  jobTitle,
  error,
  id = "meetingUrl",
}: {
  defaultValue: string;
  // Старая постоянная ссылка компании — запасной вариант, если
  // у человека своей ещё нет.
  companyLink?: string | null;
  candidateName?: string | null;
  jobTitle?: string | null;
  error?: string;
  id?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const defaults = useMeetingDefaults();
  const toast = useToast();

  const myLink = defaults.link ?? companyLink ?? null;

  function onMeetClick() {
    if (myLink) {
      setValue(myLink);
      return;
    }
    setDraft("");
    setDraftError("");
    setAsking(true);
  }

  function saveLink() {
    const formData = new FormData();
    formData.set("meetingLink", draft);
    startTransition(async () => {
      try {
        const result = await saveMyMeetingLink(formData);
        if (!result.ok) {
          setDraftError(result.error);
          return;
        }
        const link = result.message ?? draft;
        defaults.setLink(link);
        setValue(link);
        setAsking(false);
        toast.success("Ссылка сохранена — дальше кнопка подставит её сама");
      } catch {
        setDraftError(NETWORK_ERROR);
      }
    });
  }

  async function copyInvite() {
    const form = inputRef.current?.form ?? null;
    const text = fillInviteTemplate(defaults.template, {
      имя: candidateName ?? "",
      вакансия: jobTitle ?? "",
      дата: humanDate(formValue(form, "date")),
      время: formValue(form, "time"),
      длительность: DURATION_TEXT[formValue(form, "durationMinutes")] ?? "",
      ссылка: value.trim(),
      компания: defaults.companyName,
      рекрутер: defaults.recruiterName,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Приглашение скопировано — вставьте его в чат с кандидатом");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Браузер не дал скопировать текст. Разрешите доступ к буферу обмена");
    }
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        Ссылка на встречу
      </label>
      <input
        ref={inputRef}
        id={id}
        name="meetingUrl"
        type="text"
        inputMode="url"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="https://meet.google.com/abc-defg-hij"
        aria-invalid={error ? true : undefined}
        className={inputClass(error, "mt-1.5")}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      <div className="mt-2 flex flex-wrap gap-2">
        {(!myLink || value.trim() !== myLink) && (
          <button type="button" onClick={onMeetClick} className={hintClass}>
            <Video className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            {myLink ? "Вставить мою ссылку Google Meet" : "Google Meet"}
          </button>
        )}

        {value.trim() && (
          <button type="button" onClick={copyInvite} className={hintClass}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" strokeWidth={2} aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            )}
            {copied ? "Скопировано" : "Скопировать приглашение"}
          </button>
        )}
      </div>

      <Modal open={asking} onClose={() => setAsking(false)} title="Ваша ссылка Google Meet">
        <p className="text-sm text-ink-soft">
          Назначьте постоянную комнату один раз — дальше кнопка будет
          подставлять её в каждое интервью сама.
        </p>

        <ol className="mt-4 space-y-4 text-sm text-ink">
          <li>
            <p className="font-medium">1. Создайте комнату в Google Meet</p>
            <a
              href={NEW_GOOGLE_MEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClass({ variant: "secondary", size: "sm" })} mt-2`}
            >
              <Video className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              Открыть Google Meet
              <ExternalLink className="h-3.5 w-3.5 text-ink-soft" strokeWidth={1.8} aria-hidden />
            </a>
            <p className="mt-1.5 text-xs text-ink-soft">
              Откроется в новой вкладке. Скопируйте адрес комнаты из строки браузера.
            </p>
          </li>
          <li>
            <label htmlFor={`${id}-mine`} className="font-medium">
              2. Вставьте ссылку сюда
            </label>
            <input
              id={`${id}-mine`}
              type="text"
              inputMode="url"
              autoComplete="off"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveLink();
                }
              }}
              placeholder="https://meet.google.com/abc-defg-hij"
              className={inputClass(draftError, "mt-1.5")}
            />
            {draftError && <p className="mt-1 text-xs text-danger">{draftError}</p>}
          </li>
        </ol>

        <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-soft">
          <Settings2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
          Поменять ссылку и текст приглашения можно в «Настройках».
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setAsking(false)}
            className={buttonClass({ variant: "secondary" })}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={saveLink}
            disabled={pending || !draft.trim()}
            className={buttonClass({ variant: "primary" })}
          >
            {pending ? "Сохраняем…" : "Сохранить и вставить"}
          </button>
        </div>
      </Modal>
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
