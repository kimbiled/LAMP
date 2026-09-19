import { defineConfig } from "vitest/config";
import path from "node:path";

// Настройка автоматических проверок.
// Проверяем «чистую» логику: разбор резюме, ссылки связи, права,
// форматирование, часовые пояса, проверку форм. База данных не нужна.

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // «server-only» — метка Next.js, вне приложения она не нужна.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
