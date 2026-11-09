import { median } from "@/lib/analytics";

// Аналитика по сотрудникам: как быстро рекрутеры закрывают вакансии
// и разбирают новых кандидатов, как быстро менеджеры дают отзывы.
// И рекомендации — правилами, без нейросетей: одни и те же цифры
// всегда дают одни и те же советы.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function daysBetweenDates(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY));
}

export function hoursBetweenDates(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / HOUR));
}

// Насколько заполнена карточка: какая доля важных полей не пустая.
// Именно эти поля нужны, чтобы с человеком можно было работать:
// связаться, понять, кто он, и посчитать, откуда пришёл.
export type CardFields = {
  phone: string | null;
  email: string | null;
  currentPosition: string | null;
  city: string | null;
  experienceYears: number | null;
  experienceMonths: number | null;
  skills: string[];
  sourceChannel: string | null;
};

export function cardCompleteness(card: CardFields): number {
  const checks = [
    Boolean(card.phone || card.email),
    Boolean(card.currentPosition),
    Boolean(card.city),
    card.experienceYears !== null || card.experienceMonths !== null,
    card.skills.length > 0,
    Boolean(card.sourceChannel),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export type RecruiterStats = {
  id: string;
  name: string;
  added: number;
  jobsClosed: number;
  // Медиана дней от открытия вакансии до закрытия.
  daysToClose: number | null;
  // Медиана дней от открытия вакансии до первого оффера по ней.
  daysToOffer: number | null;
  // Медиана часов от добавления кандидата до первого движения по этапам.
  hoursToFirstMove: number | null;
  // Кандидаты, которые больше двух суток стоят на первом этапе.
  untouched: number;
  // Средняя заполненность карточек, которые завёл рекрутер, в процентах.
  completeness: number | null;
};

export type ManagerStats = {
  id: string;
  name: string;
  jobs: number;
  interviews: number;
  feedbacks: number;
  // Медиана часов от конца встречи до отзыва.
  hoursToFeedback: number | null;
  // Прошедшие встречи, по которым отзыва так и нет.
  awaiting: number;
};

export function medianOrNull(values: number[]): number | null {
  return median(values);
}

// Подпись срока: «5 ч», «2 дн».
export function durationText(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 24) return `${hours} ч`;
  return `${Math.round(hours / 24)} дн`;
}

// Рекомендации по цифрам команды. Пороги выбраны по здравому смыслу
// подбора: кандидат остывает за двое суток без ответа, отзыв после
// встречи нужен в тот же или на следующий день, карточка без контактов
// и должности почти бесполезна.
export function teamRecommendations(
  recruiters: RecruiterStats[],
  managers: ManagerStats[],
): string[] {
  const tips: string[] = [];

  for (const person of recruiters) {
    if (person.hoursToFirstMove !== null && person.hoursToFirstMove > 48) {
      tips.push(
        `${person.name}: новые кандидаты ждут первого движения ${durationText(person.hoursToFirstMove)}. ` +
          "Кандидат остывает за двое суток — договоритесь разбирать новые отклики каждый день.",
      );
    }
    if (person.untouched >= 5) {
      tips.push(
        `${person.name}: ${person.untouched} кандидатов больше двух суток стоят на первом этапе. ` +
          "Стоит выделить час на разбор или передать часть коллеге.",
      );
    }
    if (person.completeness !== null && person.completeness < 60 && person.added >= 3) {
      tips.push(
        `${person.name}: карточки заполнены на ${person.completeness}%. ` +
          "Без должности, города и канала трудно искать людей и считать, какой источник работает.",
      );
    }
    if (person.daysToClose !== null && person.daysToClose > 45) {
      tips.push(
        `${person.name}: вакансия закрывается в среднем за ${person.daysToClose} дн. ` +
          "Проверьте требования и зарплатную вилку вместе с заказчиком — возможно, они не совпадают с рынком.",
      );
    }
  }

  for (const person of managers) {
    if (person.hoursToFeedback !== null && person.hoursToFeedback > 48) {
      tips.push(
        `${person.name}: отзыв после интервью приходит через ${durationText(person.hoursToFeedback)}. ` +
          "Попросите оставлять мнение в тот же день — пока впечатление свежее, а кандидат не ушёл к другим.",
      );
    }
    if (person.awaiting >= 3) {
      tips.push(
        `${person.name}: ${person.awaiting} прошедших встреч без отзыва. ` +
          "Напомните — без мнения нельзя двигать кандидата дальше.",
      );
    }
  }

  // Сравнение внутри команды: самый быстрый может поделиться опытом.
  const withSpeed = recruiters.filter((person) => person.hoursToFirstMove !== null);
  if (withSpeed.length >= 2) {
    const sorted = [...withSpeed].sort(
      (a, b) => (a.hoursToFirstMove ?? 0) - (b.hoursToFirstMove ?? 0),
    );
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const bestHours = best.hoursToFirstMove ?? 0;
    const worstHours = worst.hoursToFirstMove ?? 0;
    if (worstHours >= Math.max(bestHours * 3, 24)) {
      tips.push(
        `${best.name} разбирает новых кандидатов быстрее всех (${durationText(bestHours)}). ` +
          `Пусть поделится приёмами с коллегой ${worst.name} (${durationText(worstHours)}).`,
      );
    }
  }

  if (tips.length === 0 && (recruiters.length > 0 || managers.length > 0)) {
    tips.push("Команда держит хороший темп: кандидаты не застревают, отзывы приходят вовремя.");
  }

  return tips;
}
