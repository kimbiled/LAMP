import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { loadFile } from "@/lib/storage";

// Выдача файла резюме.
//
// Файл нельзя открыть по прямой ссылке на папку: он отдаётся только этим
// адресом и только после проверки — кто вы, из какой компании и есть ли
// у вас доступ к этому кандидату.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new Response("Требуется вход", { status: 401 });
  }

  const { id } = await params;

  // Владелец системы открывает резюме любой компании — это его раздел
  // «Все кандидаты». Всем остальным файл выдаётся только внутри своей
  // компании и только если кандидат им вообще виден.
  const resume = await db.resume.findFirst({
    where: session.user.isSuperAdmin
      ? { id }
      : {
          id,
          companyId: session.user.companyId,
          candidate: candidateVisibilityFilter(session.user),
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
    },
  });
}
