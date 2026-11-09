import { getSession } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { renderCandidatePdf } from "@/lib/pdf/candidate-resume";
import {
  attachmentHeader,
  exportFileName,
  loadCandidateExport,
  readExportMode,
} from "@/lib/export/candidate-export";

// Выгрузка резюме кандидата в PDF.
//
// /api/candidates/<id>/pdf                 — с контактами
// /api/candidates/<id>/pdf?mode=nocontacts — без телефона, почты и Telegram
// /api/candidates/<id>/pdf?mode=anonymous  — без имени, фото и контактов
// (старое ?contacts=0 тоже работает)
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
  const mode = readExportMode(new URL(request.url));

  const loaded = await loadCandidateExport({
    candidateId: id,
    user: session.user,
    companyName: session.company.name,
    mode,
  });

  if (!loaded) {
    return new Response("Кандидат не найден", { status: 404 });
  }

  const pdf = await renderCandidatePdf(loaded.data);

  // Резюме с личными данными уходит за пределы системы — записываем,
  // кто и когда его выгрузил.
  await logAction({
    companyId: session.user.companyId,
    userId: session.user.id,
    action: "CANDIDATE_PDF_EXPORTED",
    entityType: "Candidate",
    entityId: loaded.id,
    meta: { format: "pdf", mode, contacts: mode === "full" },
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": attachmentHeader(
        exportFileName(loaded.fullName, mode, "pdf"),
        "resume.pdf",
      ),
      "Cache-Control": "private, no-store",
    },
  });
}
