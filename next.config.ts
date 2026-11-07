import type { NextConfig } from "next";

// Заголовки безопасности. Браузер получает их с каждой страницей
// и по ним понимает, чего делать нельзя.
const securityHeaders = [
  // Запрет встраивать LAMP в чужой сайт внутри рамки —
  // защита от подмены интерфейса поверх настоящего.
  { key: "X-Frame-Options", value: "DENY" },
  // Запрет браузеру «догадываться» о типе файла.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // При переходе на чужой сайт не передавать полный адрес страницы.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Система не пользуется камерой, микрофоном и геопозицией.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  // Эти пакеты Next не должен перепаковывать.
  //
  // tesseract.js запускает отдельный процесс для распознавания и ищет
  // его файл по своему пути на диске. После перепаковки путь ломается
  // («Cannot find module ...\\worker-script\\node\\index.js»), и OCR
  // падает. @napi-rs/canvas — вообще двоичный модуль для системы.
  serverExternalPackages: ["tesseract.js", "@napi-rs/canvas"],

  // Шрифты для выгрузки резюме в PDF читаются с диска во время работы.
  // Next сам их не видит (это не import), и без этой строки на Vercel
  // файлов не будет рядом с кодом — выгрузка упадёт.
  outputFileTracingIncludes: {
    "/api/candidates/*/pdf": ["./src/lib/pdf/fonts/**/*"],
  },

  // Разрешаем открывать систему в разработке по адресу компьютера
  // в домашней сети — иначе Next.js ругается на запросы «со стороны».
  // Нужно, чтобы ссылки «Поделиться» открывались с телефона.
  allowedDevOrigins: ["192.168.1.66"],

  // Значок «N» режима разработки выключен: в любом углу он закрывал
  // что-нибудь нужное (слева — «Выйти», справа — «Удалить кандидата»).
  // Ошибки сборки и страницы Next всё равно покажет поверх экрана.
  // Пользователи этот значок не видят никогда — он есть только
  // при npm run dev.
  devIndicators: false,

  experimental: {
    serverActions: {
      // Резюме бывают тяжёлыми: поднимаем предел с 1 МБ до 12 МБ.
      // Сам файл мы дополнительно ограничиваем 10 МБ при проверке.
      bodySizeLimit: "12mb",
    },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers:
          process.env.NODE_ENV === "production"
            ? [
                ...securityHeaders,
                // Только по защищённому соединению — после публикации.
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
                },
              ]
            : securityHeaders,
      },
    ];
  },
};

export default nextConfig;
