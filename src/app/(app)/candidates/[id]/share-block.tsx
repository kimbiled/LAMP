"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import {
  createShareLink,
  revokeShareLink,
  type ShareFormState,
} from "@/app/actions/share";
import { SelectField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { buttonClass } from "@/components/ui/styles";

// Ссылки «Поделиться»: создание, показ, копирование, отзыв.
//
// Адрес показывается целиком и его можно открыть кнопкой рядом —
// так сразу видно, куда ведёт ссылка, и не нужно надеяться на буфер обмена.

export type ShareLinkView = {
  id: string;
  token: string;
  createdByName: string;
  createdText: string;
  expiresText: string | null;
  isExpired: boolean;
  viewCount: number;
  feedbackCount: number;
};

// Адрес системы. На сервере он известен, только если прописан APP_URL,
// иначе берём его из браузера. На сервере такого адреса нет, поэтому
// сначала отдаём пустую строку — так разметка сервера и браузера
// совпадают, и React не ругается на несовпадение.
const noSubscribe = () => () => {};

function useBaseUrl(fromServer: string | null) {
  const fromBrowser = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );

  return fromServer ?? fromBrowser;
}

function isLocalAddress(base: string) {
  const host = (base.split("//")[1] ?? "").split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || base.includes("[::1]");
}

function ShareLinkAddress({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        type="text"
        readOnly
        value={url}
        aria-label="Адрес ссылки"
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-ink focus:ring-2 focus:ring-accent"
      />

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            window.prompt("Скопируйте ссылку вручную:", url);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink transition hover:border-ink-soft"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {copied ? "Скопировано" : "Копировать"}
      </button>

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink transition hover:border-ink-soft"
      >
        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
        Открыть
      </a>
    </div>
  );
}

export function ShareBlock({
  candidateId,
  links,
  canShare,
  baseUrl,
}: {
  candidateId: string;
  links: ShareLinkView[];
  canShare: boolean;
  baseUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    createShareLink.bind(null, candidateId),
    {} as ShareFormState,
  );

  const base = useBaseUrl(baseUrl);
  const local = Boolean(base) && isLocalAddress(base);

  if (!canShare) {
    return null;
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink-strong">Поделиться</h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink transition hover:bg-canvas"
        >
          <Share2 className="h-4 w-4" strokeWidth={1.8} />
          {open ? "Свернуть" : "Создать ссылку"}
        </button>
      </div>

      <p className="mt-2 text-xs text-ink-soft">
        По ссылке можно открыть карточку кандидата без входа в систему и
        оставить отзыв. Остальные данные компании при этом недоступны.
      </p>

      {local && links.length > 0 && (
        <p className="mt-2 rounded-lg border border-line bg-glow px-3 py-2 text-xs text-ink">
          Адрес начинается с <span className="font-mono">localhost</span> — это
          имя работает только на том компьютере, где запущена система. Коллеге
          или на телефоне такая ссылка не откроется. Когда опубликуем систему в
          интернете, ссылки станут рабочими автоматически.
        </p>
      )}

      {open && (
        <form
          action={formAction}
          className="mt-4 space-y-3 rounded-lg border border-line bg-canvas p-4"
        >
          {state.formError && (
            <div className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger">
              {state.formError}
            </div>
          )}

          <SelectField
            label="Срок действия"
            name="expiresInDays"
            defaultValue="30"
            options={[
              { value: "7", label: "7 дней" },
              { value: "30", label: "30 дней" },
              { value: "90", label: "90 дней" },
              { value: "0", label: "Без срока" },
            ]}
            hint="По истечении срока ссылка перестанет открываться"
          />

          <div className="sm:w-48">
            <SubmitButton pendingLabel="Создаём…">Создать ссылку</SubmitButton>
          </div>
        </form>
      )}

      {links.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Ссылок пока нет.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="rounded-lg border border-line bg-canvas p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-ink">
                    {link.isExpired ? "Недействительна" : "Действует"}
                  </p>
                  {link.expiresText ? (
                    <span className="text-xs text-ink-soft">
                      {link.isExpired ? "истекла" : "до"} {link.expiresText}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-soft">без срока</span>
                  )}
                </div>

                {!link.isExpired && (
                  <ConfirmForm
                    action={revokeShareLink}
                    confirm={{
                      title: "Отозвать ссылку?",
                      message: "Кто откроет её после этого, увидит, что ссылка больше не действует.",
                      confirmLabel: "Отозвать",
                      danger: true,
                    }}
                  >
                    <input type="hidden" name="linkId" value={link.id} />
                    <button
                      type="submit"
                      className={buttonClass({ variant: "danger-outline", size: "sm" })}
                    >
                      Отозвать
                    </button>
                  </ConfirmForm>
                )}
              </div>

              {!link.isExpired && base && (
                <ShareLinkAddress url={`${base}/share/${link.token}`} />
              )}

              <p className="mt-2 text-xs text-ink-soft">
                Создал {link.createdByName} · {link.createdText} · просмотров:{" "}
                {link.viewCount} · отзывов: {link.feedbackCount}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
