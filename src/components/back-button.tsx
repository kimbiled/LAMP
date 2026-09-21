"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NAV_MEMORY_KEY } from "@/components/nav-memory";

// Кнопка «Назад».
//
// Обычная ссылка возвращала бы всегда в одно и то же место: с карточки
// кандидата — в общий список. Но если вы пришли туда со страницы
// вакансии, вернуться хочется именно на неё.
//
// Поэтому кнопка сначала пробует шаг назад по истории браузера,
// и только если идти некуда — например, страницу открыли по прямой
// ссылке в новой вкладке — уводит в список, указанный в fallback.
//
// Внутри это настоящая ссылка: она работает и без JavaScript,
// и её можно открыть в новой вкладке средней кнопкой мыши.

export function BackButton({
  fallbackHref,
  fallbackLabel,
}: {
  fallbackHref: string;
  fallbackLabel: string;
}) {
  const router = useRouter();

  return (
    <Link
      href={fallbackHref}
      title={`Назад · ${fallbackLabel}`}
      onClick={(event) => {
        // Ctrl, Shift и средняя кнопка открывают новую вкладку —
        // туда не вмешиваемся.
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0
        ) {
          return;
        }

        // Шаг назад делаем, только если внутри системы уже были
        // переходы. Иначе — если страницу открыли по прямой ссылке
        // в новой вкладке — назад вело бы на пустой экран.
        let navigated = false;
        try {
          navigated = sessionStorage.getItem(NAV_MEMORY_KEY) === "1";
        } catch {
          // Приватный режим. Останется переход по ссылке ниже.
        }

        if (navigated) {
          event.preventDefault();
          router.back();
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
      Назад
    </Link>
  );
}
