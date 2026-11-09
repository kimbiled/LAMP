"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { saveMascot } from "@/app/actions/mascot";
import { Mascot } from "@/components/mascot";
import { MASCOT_PARTS, type MascotLook, type MascotPart } from "@/lib/mascot";
import { buttonClass } from "@/components/ui/styles";
import { NETWORK_ERROR, useToast } from "@/components/ui/toast";

// Примерочная: слева персонаж, справа вещи. Закрытые вещи видны с
// замком и подписью, сколько вакансий нужно закрыть, — чтобы было
// к чему стремиться.

export function MascotEditor({
  initial,
  closed,
}: {
  initial: MascotLook;
  closed: number;
}) {
  const [look, setLook] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const changed = MASCOT_PARTS.some(({ part }) => look[part] !== initial[part]);

  function pick(part: MascotPart, id: string) {
    setLook((current) => ({ ...current, [part]: id }));
  }

  function save() {
    const formData = new FormData();
    for (const { part } of MASCOT_PARTS) formData.set(part, look[part]);
    startTransition(async () => {
      try {
        const result = await saveMascot(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Сохранено");
        router.refresh();
      } catch {
        toast.error(NETWORK_ERROR);
      }
    });
  }

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="h-fit rounded-2xl border border-line bg-surface p-5 text-center lg:sticky lg:top-6">
        <div className="flex justify-center rounded-xl bg-canvas py-4">
          <Mascot look={look} size={220} />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!changed || pending}
          className={buttonClass({ variant: "primary", full: true, className: "mt-4" })}
        >
          {pending ? "Сохраняем…" : changed ? "Сохранить образ" : "Образ сохранён"}
        </button>
        {changed && (
          <button
            type="button"
            onClick={() => setLook(initial)}
            className="mt-2 text-sm text-ink-soft underline hover:text-ink"
          >
            Вернуть как было
          </button>
        )}
      </div>

      <div className="space-y-5">
        {MASCOT_PARTS.map(({ part, title, options }) => (
          <section key={part} className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-ink-strong">{title}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {options.map((option) => {
                // Открыто: хватает закрытых вакансий, или вещь уже была надета.
                const open = option.need <= closed || initial[part] === option.id;
                const chosen = look[part] === option.id;
                const preview = { ...look, [part]: option.id };
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={!open}
                    aria-pressed={chosen}
                    onClick={() => pick(part, option.id)}
                    title={open ? option.label : `Откроется после ${option.need} закрытых вакансий в месяце`}
                    className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 text-xs transition ${
                      chosen
                        ? "border-ink bg-glow font-medium text-ink"
                        : open
                          ? "border-line text-ink hover:border-ink-soft"
                          : "cursor-not-allowed border-dashed border-line text-ink-faint"
                    }`}
                  >
                    <span className={open ? "" : "opacity-35 grayscale"}>
                      <Mascot look={preview} size={64} title={option.label} />
                    </span>
                    {option.label}
                    {!open && (
                      <span className="flex items-center gap-1 text-[11px] text-ink-soft">
                        <Lock className="size-3" aria-hidden />
                        {option.need} вак.
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
