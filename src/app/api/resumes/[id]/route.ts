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
    // Запись о файле в базе есть, а самого файла нет. Так бывает, когда
    // база общая, а файлы хранятся на диске того компьютера, где их
    // загрузили (STORAGE_DRIVER=local): на другом компьютере или на
    // Vercel их просто нет. Говорим об этом по-человечески, а не голой
    // строкой «не найден».
    return missingFilePage(resume.fileName);
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function missingFilePage(fileName: string): Response {
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Файл резюме недоступен — LAMP</title>
<style>
  body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f7f5ef;color:#181818}
  main{max-width:560px;margin:12vh auto;padding:28px;background:#fffefb;border:1px solid #ded8cc;border-radius:16px}
  h1{font-size:20px;margin:0 0 8px} p{font-size:15px;line-height:1.5;color:#5f5b54;margin:8px 0}
  code{background:#ede9df;padding:1px 6px;border-radius:6px;color:#181818}
  button{margin-top:16px;font:inherit;font-size:14px;padding:9px 16px;border-radius:8px;border:1px solid #8f887b;background:#fffefb;cursor:pointer}
</style></head>
<body><main>
  <h1>Файл «${escapeHtml(fileName)}» не найден в хранилище</h1>
  <p>Запись о резюме есть, а самого файла на этом сервере нет. Скорее всего,
  его загрузили на другом компьютере или в другой копии LAMP: файлы сейчас
  хранятся на диске того устройства, где их загрузили.</p>
  <p>Что сделать: загрузите резюме ещё раз в карточке кандидата.
  Чтобы такого больше не было, файлы нужно хранить в общем облачном
  хранилище (<code>STORAGE_DRIVER=s3</code>).</p>
  <button onclick="window.close(); history.back()">Закрыть</button>
</main></body></html>`;

  return new Response(html, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
