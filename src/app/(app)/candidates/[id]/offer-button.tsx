"use client";

import { useState, useTransition } from "react";
import { BadgeCheck } from "lucide-react";
import { proposeOffer } from "@/app/actions/feedback";
import { Modal } from "@/components/ui/dialog";
import { buttonClass, inputClass, LABEL_CLASS } from "@/components/ui/styles";
import { NETWORK_ERROR, useToast } from "@/components/ui/toast";

// Кнопка «Предложить оффер» для нанимающего менеджера.
// Открывает окно с необязательным комментарием («готовы на 600 тысяч,
// выход с 1 декабря») и отправляет уведомление администратору и рекрутеру.

export function OfferButton({
  candidateId,
  candidateName,
}: {
  candidateId: string;
  candidateName: string;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function submit() {
    const formData = new FormData();
    formData.set("candidateId", candidateId);
    formData.set("comment", comment);
    startTransition(async () => {
      try {
        const result = await proposeOffer(formData);
        if (result.ok) {
          toast.success(result.message ?? "Отправлено");
          setOpen(false);
          setComment("");
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error(NETWORK_ERROR);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass({ variant: "positive" })}
      >
        <BadgeCheck className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        Предложить оффер
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Оффер: ${candidateName}`}>
        <p className="text-sm text-ink-soft">
          Администратор и рекрутер вакансии получат уведомление, а в карточке
          появится ваш положительный отзыв с пометкой «Предлагаю оффер».
        </p>
        <label htmlFor="offer-comment" className={`${LABEL_CLASS} mt-4`}>
          Комментарий <span className="font-normal text-ink-soft">— необязательно</span>
        </label>
        <textarea
          id="offer-comment"
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Например: готовы обсуждать до 600 000 ₸, выход с 1 декабря"
          className={inputClass(false, "mt-1.5")}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={buttonClass({ variant: "secondary" })}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className={buttonClass({ variant: "positive" })}
          >
            {pending ? "Отправляем…" : "Предложить оффер"}
          </button>
        </div>
      </Modal>
    </>
  );
}
