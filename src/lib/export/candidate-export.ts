import "server-only";
import { db } from "@/lib/db";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { loadFile } from "@/lib/storage";
import type { CandidatePdfData } from "@/lib/pdf/candidate-resume";
import type { Role } from "@/generated/prisma/enums";

// Данные для выгрузки резюме — общие для PDF и Word, чтобы два файла
// никогда не расходились по содержанию.
//
// Три варианта:
//   full       — всё, включая телефон, почту и Telegram;
//   nocontacts — без контактов (заказчику, который не должен звонить сам);
//   anonymous  — без имени, фото, контактов и даты рождения.
//
// Отзывы, этапы и комментарии рекрутера сюда не попадают никогда.

export type ExportMode = "full" | "nocontacts" | "anonymous";

// ?mode=… — новый вид адреса; ?contacts=0 — старый, остаётся рабочим,
// чтобы не сломать уже сохранённые ссылки.
export function readExportMode(url: URL): ExportMode {
  const mode = url.searchParams.get("mode");
  if (mode === "full" || mode === "nocontacts" || mode === "anonymous") {
    return mode;
  }
  return url.searchParams.get("contacts") === "0" ? "nocontacts" : "full";
}

export async function loadCandidateExport(params: {
  candidateId: string;
  user: { id: string; role: Role; companyId: string };
  companyName: string;
  mode: ExportMode;
}): Promise<{ id: string; fullName: string; data: CandidatePdfData } | null> {
  // Компания — из сессии, видимость — по правам человека.
  const candidate = await db.candidate.findFirst({
    where: {
      id: params.candidateId,
      companyId: params.user.companyId,
      ...candidateVisibilityFilter(params.user),
    },
    include: {
      experience: { orderBy: { sortOrder: "asc" } },
      education: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!candidate) return null;

  const anonymous = params.mode === "anonymous";

  // Фото не обязательно: если файла нет в хранилище, выгружаем без него.
  // В анонимной выгрузке фото не берём вовсе.
  let photo: Buffer | null = null;
  if (candidate.photoKey && !anonymous) {
    try {
      photo = await loadFile(candidate.photoKey);
    } catch {
      photo = null;
    }
  }

  return {
    id: candidate.id,
    fullName: candidate.fullName,
    data: {
      fullName: candidate.fullName,
      currentPosition: candidate.currentPosition,
      city: candidate.city,
      birthDate: candidate.birthDate,
      experienceYears: candidate.experienceYears,
      experienceMonths: candidate.experienceMonths,
      salaryExpectation: candidate.salaryExpectation,
      currency: candidate.currency,
      phone: candidate.phone,
      email: candidate.email,
      telegram: candidate.telegram,
      skills: candidate.skills,
      languages: candidate.languages,
      experience: candidate.experience,
      education: candidate.education,
      photo,
      companyName: params.companyName,
      showContacts: params.mode === "full",
      anonymous,
    },
  };
}

// Имя файла: в анонимной выгрузке фамилии нет и в названии.
export function exportFileName(
  fullName: string,
  mode: ExportMode,
  extension: "pdf" | "docx",
): string {
  const base = mode === "anonymous" ? "Кандидат" : fullName;
  return `${base} — резюме.${extension}`;
}

// Имя по-русски — через filename*, а для старых программ
// запасное латиницей.
export function attachmentHeader(fileName: string, fallback: string): string {
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
