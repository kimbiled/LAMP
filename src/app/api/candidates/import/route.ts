import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { jobVisibilityFilter } from "@/lib/permissions";
import { MAX_FILE_BYTES, extensionFor } from "@/lib/storage";
import { processResume } from "@/lib/resume/pipeline";
import { createCandidateFromResume } from "@/lib/candidate-from-resume";

// Приём одного резюме из файла, собранного расширением.
//
// Страница импорта шлёт сюда кандидатов по одному, а не всю пачку разом.
// Так видно живой ход работы, а если на каком-то резюме споткнулись —
// остальные всё равно заводятся. Пачкой из тридцати файлов рисковать
// ради одного запроса незачем.
//
// Сюда приходит обычная сессия: человек залогинен в LAMP и сам нажал
// «Импортировать». Никаких отдельных ключей для расширения не нужно —
// расширение с LAMP вообще не разговаривает, оно отдаёт файл.

const Body = z.object({
  url: z.string().url().max(500),
  fileName: z.string().min(1).max(200),
  fileBase64: z.string().min(100),
  jobId: z.string().optional().nullable(),
  hints: z
    .object({
      fullName: z.string().nullable().optional(),
      position: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
    })
    .optional()
    .nullable(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  if (!can(session.user.role, "candidates.create")) {
    return Response.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const parsedBody = Body.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return Response.json({ error: "Испорченная запись" }, { status: 400 });
  }

  const body = parsedBody.data;
  const companyId = session.user.companyId;

  // Того же человека второй раз не заводим: ссылка на резюме у hh
  // постоянная, по ней и узнаём. Это спасает, когда одну и ту же
  // пачку загрузили дважды.
  const already = await db.candidate.findFirst({
    where: { companyId, sourceUrl: body.url },
    select: { id: true, fullName: true },
  });

  if (already) {
    return Response.json({
      status: "already",
      candidateId: already.id,
      fullName: already.fullName,
    });
  }

  let data: Buffer;
  try {
    data = Buffer.from(body.fileBase64, "base64");
  } catch {
    return Response.json({ error: "Файл не читается" }, { status: 400 });
  }

  if (data.length === 0 || data.length > MAX_FILE_BYTES) {
    return Response.json({ error: "Неподходящий размер файла" }, { status: 400 });
  }

  const mimeType = "application/pdf";
  const extension = extensionFor(mimeType);
  if (!extension) {
    return Response.json({ error: "Неподходящий формат" }, { status: 400 });
  }

  const processed = await processResume(data, mimeType);

  if (processed.text.trim().length < 30) {
    return Response.json(
      { error: "Из файла не удалось прочитать текст" },
      { status: 422 },
    );
  }

  // Подсказки со страницы hh — только туда, где разборщик ничего
  // не нашёл. Своим правилам доверяем больше: они читают весь документ,
  // а подсказка взята из одного места в вёрстке.
  if (body.hints) {
    processed.parsed.fullName ||= body.hints.fullName || null;
    processed.parsed.currentPosition ||= body.hints.position || null;
    processed.parsed.city ||= body.hints.city || null;
  }

  const jobId = body.jobId
    ? ((
        await db.job.findFirst({
          where: {
            id: body.jobId,
            companyId,
            ...jobVisibilityFilter(session.user),
          },
          select: { id: true },
        })
      )?.id ?? null)
    : null;

  const created = await createCandidateFromResume({
    companyId,
    actorId: session.user.id,
    actorName: session.user.fullName,
    jobId,
    file: { data, fileName: body.fileName, mimeType, extension },
    processed,
    source: { label: new URL(body.url).hostname, url: body.url },
  });

  if ("error" in created) {
    return Response.json({ error: created.error }, { status: 400 });
  }

  return Response.json({
    status: "created",
    candidateId: created.candidateId,
    fullName: processed.parsed.fullName ?? body.fileName,
    score: processed.quality.score,
    duplicates: created.duplicates.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      matchedBy: item.matchedBy,
    })),
  });
}
