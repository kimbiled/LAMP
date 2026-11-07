import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { loadFile } from "@/lib/storage";
import { logAction } from "@/lib/audit";
import { renderCandidatePdf } from "@/lib/pdf/candidate-resume";

// Выгрузка резюме кандидата в PDF.
//
// /api/candidates/<id>/pdf             — с контактами
// /api/candidates/<id>/pdf?contacts=0  — без телефона, почты и Telegram
//
// Проверки те же, что у файла резюме: только своя компания и только
// если кандидат виден этому человеку. Компания берётся из сессии,
// а не из адреса.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new Response("Требуется вход", { status: 401 });
  }

  const { id } = await params;

  const candidate = await db.candidate.findFirst({
    where: {
      id,
      companyId: session.user.companyId,
      ...candidateVisibilityFilter(session.user),
    },
    include: {
      experience: { orderBy: { sortOrder: "asc" } },
      education: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!candidate) {
    return new Response("Кандидат не найден", { status: 404 });
  }

  const showContacts =
    new URL(request.url).searchParams.get("contacts") !== "0";

  // Фото не обязательно: если файла нет в хранилище, выгружаем без него.
  let photo: Buffer | null = null;
  if (candidate.photoKey) {
    try {
      photo = await loadFile(candidate.photoKey);
    } catch {
      photo = null;
    }
  }

  const pdf = await renderCandidatePdf({
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
    companyName: session.company.name,
    showContacts,
  });

  // Резюме с личными данными уходит за пределы системы — записываем,
  // кто и когда его выгрузил.
  await logAction({
    companyId: session.user.companyId,
    userId: session.user.id,
    action: "CANDIDATE_PDF_EXPORTED",
    entityType: "Candidate",
    entityId: candidate.id,
    meta: { contacts: showContacts },
  });

  // Имя файла по-русски — через filename*, а для старых программ
  // запасное латиницей.
  const fileName = `${candidate.fullName} — резюме.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `attachment; filename="resume.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
