// Разовый замер: сколько занимает один поход в базу.
// Нужен, чтобы понимать, из чего складывается время открытия страницы:
// база в Франкфурте, и дорога туда и обратно — это нижняя граница,
// быстрее которой страница не откроется при всём желании.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const times: number[] = [];

  for (let i = 0; i < 8; i++) {
    const started = Date.now();
    await db.company.count();
    times.push(Date.now() - started);
  }

  // Первый замер выбрасываем: в него входит установка соединения.
  const first = times.shift();
  times.sort((a, b) => a - b);

  console.log(`Первое соединение: ${first} мс`);
  console.log(`Последующие запросы: ${times.join(", ")} мс`);
  console.log(`Медиана: ${times[Math.floor(times.length / 2)]} мс`);

  await db.$disconnect();
}

main();
