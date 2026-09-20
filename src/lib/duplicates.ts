import "server-only";
import { db } from "@/lib/db";
import { phoneKey } from "@/lib/contacts";

// Поиск уже заведённых кандидатов с теми же контактами.
//
// Телефон сравниваем по последним десяти цифрам: один и тот же номер
// пишут как +7 701 123 45 67, 87011234567 и 7011234567, и для человека
// это очевидно один номер, а для базы — три разные строки. Поэтому
// у карточки есть отдельное поле phoneKey с этими самыми цифрами.

export type DuplicateMatch = {
  id: string;
  fullName: string;
  matchedBy: "phone" | "email";
  stageName: string;
  jobTitle: string | null;
  createdText: string;
};

export async function findDuplicates(params: {
  companyId: string;
  phone?: string | null;
  email?: string | null;
  exceptId?: string;
}): Promise<DuplicateMatch[]> {
  const key = phoneKey(params.phone ?? null);
  const email = params.email?.trim().toLowerCase() || null;

  if (!key && !email) {
    return [];
  }

  const conditions: Record<string, unknown>[] = [];
  if (key) conditions.push({ phoneKey: key });
  if (email) conditions.push({ email: { equals: email, mode: "insensitive" } });

  const found = await db.candidate.findMany({
    where: {
      companyId: params.companyId,
      ...(params.exceptId ? { id: { not: params.exceptId } } : {}),
      OR: conditions,
    },
    select: {
      id: true,
      fullName: true,
      phoneKey: true,
      email: true,
      createdAt: true,
      stage: { select: { name: true } },
      job: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return found.map((candidate) => ({
    id: candidate.id,
    fullName: candidate.fullName,
    // Совпадение по телефону убедительнее: почту иногда заводят общую
    // на семью, а номер почти всегда принадлежит одному человеку.
    matchedBy: key && candidate.phoneKey === key ? "phone" : "email",
    stageName: candidate.stage.name,
    jobTitle: candidate.job?.title ?? null,
    createdText: candidate.createdAt.toISOString(),
  }));
}
