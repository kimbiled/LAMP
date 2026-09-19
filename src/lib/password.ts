import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Пароли никогда не хранятся в открытом виде.
// Мы храним «отпечаток» пароля: из него нельзя восстановить исходный пароль,
// но можно проверить, что человек ввёл именно его.

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  // Соль — случайная добавка к паролю. Благодаря ей два одинаковых пароля
  // дают разные отпечатки, и готовые таблицы взлома бесполезны.
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);

  // Сравнение за одинаковое время — чтобы по скорости ответа
  // нельзя было подбирать пароль по символам.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
