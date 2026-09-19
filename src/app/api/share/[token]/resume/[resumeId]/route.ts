import { db } from "@/lib/db";
import { findValidShareLink } from "@/lib/share";
import { loadFile } from "@/lib/storage";

// Выдача резюме по ссылке «Поделиться».
// Проверяем не пользователя, а саму ссылку: действует ли она
// и относится ли запрошенный файл именно к её кандидату.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; resumeId: string }> },
) {
  const { token, resumeId } = await params;

  const link = await findValidShareLink(token);
  if (!link) {
    return new Response("Ссылка недоступна", { status: 404 });
  }

  const resume = await db.resume.findFirst({
    where: {
      id: resumeId,
      companyId: link.companyId,
      candidateId: link.candidateId,
    },
  });

  if (!resume) {
    return new Response("Файл не найден", { status: 404 });
  }

  let data: Buffer;
  try {
    data = await loadFile(resume.storageKey);
  } catch {
    return new Response("Файл не найден в хранилище", { status: 404 });
  }

  const download = new URL(request.url).searchParams.has("download");
  const encodedName = encodeURIComponent(resume.fileName);

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": resume.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
