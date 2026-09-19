import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Резюме бывают тяжёлыми: поднимаем предел с 1 МБ до 12 МБ.
      // Сам файл мы дополнительно ограничиваем 10 МБ при проверке.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
