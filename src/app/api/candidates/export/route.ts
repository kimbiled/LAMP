import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { candidateWhereFrom, readCandidateFilters } from "@/lib/candidate-filters";
import { SOURCE_CHANNEL_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { toCsv } from "@/lib/csv";

// Выгрузка списка кандидатов в Excel — с теми же фильтрами, что
// в списке на странице. Только своя компания и только те, кого
// человек и так видит. Каждая выгрузка пишется в журнал: это
// личные данные людей.

// Больше за раз не отдаём: такой файл всё равно неудобно читать,
// а запрос к базе становится тяжёлым.
const MAX_ROWS = 5000;

const HEADER = [
  "ФИО",
  "Должность",
  "Телефон",
  "Почта",
  "Telegram",
  "Город",
  "Вакансия",
  "Этап",
  "Канал привлечения",
  "Источник",
  "Опыт, лет",
  "Ожидания по зарплате",
  "Валюта",
  "Навыки",
  "Языки",
  "Метки",
  "Последнее место работы",
  "Образование",
  "Добавлен",
  "Карточка в Skillo",
];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Требуется вход", { status: 401 });
  }
  if (!can(session.user.role, "candidates.export")) {
    return new Response("Недостаточно прав", { status: 403 });
  }

  const url = new URL(request.url);
  const filters = readCandidateFilters(url.searchParams);
  const where = candidateWhereFrom(filters, session.user);

  const candidates = await db.candidate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: {
      job: { select: { title: true } },
      stage: { select: { name: true } },
      tags: { select: { name: true }, orderBy: { name: "asc" } },
      experience: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { companyName: true, position: true },
      },
      education: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { institution: true, years: true },
      },
    },
  });

  const base = url.origin;

  const rows = candidates.map((candidate) => {
    const lastJob = candidate.experience[0];
    const study = candidate.education[0];
    const years =
      candidate.experienceYears ??
      (candidate.experienceMonths ? Math.floor(candidate.experienceMonths / 12) : null);

    return [
      candidate.fullName,
      candidate.currentPosition,
      candidate.phone,
      candidate.email,
      candidate.telegram,
      candidate.city,
      candidate.job?.title ?? "",
      candidate.stage.name,
      candidate.sourceChannel ? SOURCE_CHANNEL_LABELS[candidate.sourceChannel] : "",
      candidate.source,
      years,
      candidate.salaryExpectation,
      candidate.salaryExpectation ? candidate.currency : "",
      candidate.skills.join(", "),
      candidate.languages.join(", "),
      candidate.tags.map((tag) => tag.name).join(", "),
      lastJob
        ? [lastJob.position, lastJob.companyName].filter(Boolean).join(" — ")
        : "",
      study ? [study.institution, study.years].filter(Boolean).join(", ") : "",
      formatDate(candidate.createdAt),
      `${base}/candidates/${candidate.id}`,
    ];
  });

  await logAction({
    companyId: session.user.companyId,
    userId: session.user.id,
    action: "CANDIDATES_EXPORTED",
    entityType: "Candidate",
    // Фильтры строкой: по журналу видно, какую именно выборку выгрузили.
    meta: { count: rows.length, filters: url.search.slice(0, 500) },
  });

  const day = new Date().toISOString().slice(0, 10);

  return new Response(toCsv(HEADER, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lamp-candidates-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
