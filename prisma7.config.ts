import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Для создания и изменения таблиц нужно прямое подключение к базе.
    url: process.env["DIRECT_URL"],
  },
});
