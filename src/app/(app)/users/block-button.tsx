"use client";

import { useTransition } from "react";
import { setUserActive } from "@/app/actions/users";
import { useConfirm } from "@/components/ui/dialog";
import { NETWORK_ERROR, useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/styles";

// Блокировка и разблокировка сотрудника.
// Блокировка выкидывает человека из системы немедленно — поэтому
// сначала спрашиваем. Разблокировка безопасна и идёт сразу.

export function BlockButton({
  userId,
  userName,
  isActive,
}: {
  userId: string;
  userName: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();

  async function toggle() {
    if (isActive) {
      const confirmed = await confirm({
        title: `Заблокировать ${userName}?`,
        message:
          "Сотрудник сразу выйдет из системы и не сможет войти, пока его не разблокируют. Его данные и действия сохранятся.",
        confirmLabel: "Заблокировать",
        danger: true,
      });
      if (!confirmed) return;
    }

    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("isActive", isActive ? "false" : "true");

    startTransition(async () => {
      try {
        const result = await setUserActive(formData);
        if (result.ok) {
          if (result.message) toast.success(result.message);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error(NETWORK_ERROR);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={buttonClass({
        variant: isActive ? "danger-outline" : "secondary",
        className: "w-full md:w-auto",
      })}
    >
      {isActive ? "Заблокировать" : "Разблокировать"}
    </button>
  );
}
