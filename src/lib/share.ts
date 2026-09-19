import "server-only";
import { db } from "@/lib/db";

// Проверка ссылки «Поделиться»: существует, не отозвана, не просрочена.
// Это единственная точка проверки — ею пользуются и страница,
// и форма фидбэка, и выдача файла резюме.

export async function findValidShareLink(token: string) {
  // Токен всегда 64 шестнадцатеричных символа. Всё остальное отсекаем
  // сразу, не обращаясь к базе.
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const link = await db.shareLink.findUnique({
    where: { token },
    select: {
      id: true,
      companyId: true,
      candidateId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!link || link.revokedAt) {
    return null;
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    return null;
  }

  return link;
}
