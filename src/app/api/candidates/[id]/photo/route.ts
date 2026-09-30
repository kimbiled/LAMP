import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { candidateVisibilityFilter } from "@/lib/permissions";
import { loadFile } from "@/lib/storage";

// Выдача фотографии кандидата.
//
// Проверки те же, что и у резюме: по прямой ссылке на папку файл
// не открыть, а этот адрес отдаёт его только своим — и только если
// кандидат вообще виден этому человеку.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new Response("Требуется вход", { status: 401 });
  }

  const { id } = await params;

  const candidate = await db.candidate.findFirst({
    where: session.user.isSuperAdmin
      ? { id }
      : {
          id,
          companyId: session.user.companyId,
          ...candidateVisibilityFilter(session.user),
        },
    select: { photoKey: true },
  });

  if (!candidate?.photoKey) {
    return new Response("Фото не найдено", { status: 404 });
  }

  let data: Buffer;
  try {
    data = await loadFile(candidate.photoKey);
  } catch {
    return new Response("Файл не найден в хранилище", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(data.length),
      // Фото не меняется, но чужим кэшам его отдавать нельзя.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
