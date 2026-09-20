import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Единственная точка подключения к базе данных.
// Все остальные файлы проекта обращаются к базе только через db.

// Настройки пула соединений.
//
// База находится во Франкфурте, и установка защищённого соединения с ней
// занимает около полусекунды. Поэтому открытые соединения нужно держать
// и переиспользовать, а не открывать заново на каждый запрос.
function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Карточка кандидата запрашивает около десяти связей сразу.
    // Если соединений меньше, лишние запросы стоят в очереди
    // и страница ждёт на ровном месте.
    max: 12,
    idleTimeoutMillis: 5 * 60 * 1000,
    connectionTimeoutMillis: 15 * 1000,
    keepAlive: true,
  });

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Важно: клиент создаётся ТОЛЬКО если его ещё нет.
// В режиме разработки Next.js перезапускает код при каждом изменении файла.
// Если создавать пул соединений при каждом перезапуске, старые пулы
// остаются висеть, соединения к базе заканчиваются и страницы зависают.
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// Прогрев соединений.
//
// Замеры: один запрос к базе идёт 79 мс, а страница делает несколько
// запросов сразу. Если соединения уже открыты, страница собирается
// за 170 мс. Если их надо открывать заново — 700 мс и больше: почти
// всё это время уходит на рукопожатие с сервером во Франкфурте.
//
// Поэтому при старте открываем несколько соединений заранее и раз
// в минуту напоминаем о себе, чтобы база их не закрыла. Запрос
// «SELECT 1» ничего не читает и не нагружает базу.
const KEEP_ALIVE_MS = 60 * 1000;
const WARM_CONNECTIONS = 6;

function keepWarm() {
  void Promise.all(
    Array.from({ length: WARM_CONNECTIONS }, () =>
      db.$queryRaw`SELECT 1`.catch(() => {
        // База могла временно уснуть — следующая попытка её разбудит.
      }),
    ),
  );
}

const globalForWarmup = globalThis as unknown as { lampWarmup?: boolean };

if (!globalForWarmup.lampWarmup) {
  globalForWarmup.lampWarmup = true;
  keepWarm();

  // unref: этот таймер не должен мешать серверу завершиться.
  setInterval(keepWarm, KEEP_ALIVE_MS).unref();
}
