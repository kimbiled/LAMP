import { getSession } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { renderCandidateDocx } from "@/lib/export/candidate-docx";
import {
  attachmentHeader,
  exportFileName,
  loadCandidateExport,
  readExportMode,
} from "@/lib/export/candidate-export";

// Выгрузка резюме кандидата в Word (DOCX). Те же три варианта, что
// и у PDF (?mode=full | nocontacts | anonymous), те же проверки доступа.

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

  const docx = await renderCandidateDocx(loaded.data);

  await logAction({
    companyId: session.user.companyId,
    userId: session.user.id,
    action: "CANDIDATE_PDF_EXPORTED",
    entityType: "Candidate",
    entityId: loaded.id,
    meta: { format: "docx", mode, contacts: mode === "full" },
  });

  return new Response(new Uint8Array(docx), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Length": String(docx.length),
      "Content-Disposition": attachmentHeader(
        exportFileName(loaded.fullName, mode, "docx"),
        "resume.docx",
      ),
      "Cache-Control": "private, no-store",
    },
  });
}
