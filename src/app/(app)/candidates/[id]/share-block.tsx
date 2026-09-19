"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import {
  createShareLink,
  revokeShareLink,
  type ShareFormState,
} from "@/app/actions/share";
import { SelectField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";

// Ссылки «Поделиться»: создание, копирование, отзыв.
// Полный адрес собирается в браузере — так он всегда правильный,
// и на локальном компьютере, и потом в интернете.

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

function CopyButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}/share/${token}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          window.prompt("Скопируйте ссылку вручную:", url);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-muted bg-surface px-3 py-1.5 text-xs text-ink transition hover:border-ink-soft"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" strokeWidth={2} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      {copied ? "Скопировано" : "Копировать ссылку"}
    </button>
  );
}

export function ShareBlock({
  candidateId,
  links,
  canShare,
}: {
  candidateId: string;
  links: ShareLinkView[];
  canShare: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    createShareLink.bind(null, candidateId),
    {} as ShareFormState,
  );

  const active = links.filter((link) => !link.isExpired);

  if (!canShare) {
    return null;
  }

  return (
    <section className="rounded-xl border border-muted bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-ink">Поделиться</h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg border border-muted px-3 py-1.5 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
        >
          <Share2 className="h-4 w-4" strokeWidth={1.8} />
          {open ? "Свернуть" : "Создать ссылку"}
        </button>
      </div>

      <p className="mt-2 text-xs text-ink-soft">
        По ссылке можно открыть карточку кандидата без входа в систему и
        оставить фидбэк. Остальные данные компании при этом недоступны.
      </p>

      {open && (
        <form
          action={formAction}
          className="mt-4 space-y-3 rounded-lg border border-muted bg-canvas p-4"
        >
          {state.formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
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
              className="rounded-lg border border-muted bg-canvas p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link2 className="h-4 w-4 text-ink-soft" strokeWidth={1.8} />
                <p className="text-sm text-ink">
                  {link.isExpired ? "Недействительна" : "Действует"}
                </p>
                {link.expiresText && (
                  <span className="text-xs text-ink-soft">
                    {link.isExpired ? "истекла" : "до"} {link.expiresText}
                  </span>
                )}
                {!link.expiresText && (
                  <span className="text-xs text-ink-soft">без срока</span>
                )}
              </div>

              <p className="mt-1 text-xs text-ink-soft">
                Создал {link.createdByName} · {link.createdText} · просмотров:{" "}
                {link.viewCount} · фидбэков: {link.feedbackCount}
              </p>

              {!link.isExpired && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyButton token={link.token} />

                  <form action={revokeShareLink}>
                    <input type="hidden" name="linkId" value={link.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-muted bg-surface px-3 py-1.5 text-xs text-ink-soft transition hover:border-red-300 hover:text-red-600"
                    >
                      Отозвать
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
