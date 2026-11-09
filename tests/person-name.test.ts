import { describe, expect, it } from "vitest";
import { firstNameOf } from "@/lib/person-name";

describe("Имя для обращения", () => {
  it.each([
    ["Петров Иван Сергеевич", "Иван"],
    ["Оспанов Данияр Серикович", "Данияр"],
    ["Оспанов Данияр", "Данияр"],
    ["Данияр Оспанов", "Данияр"],
    ["Иван Петров", "Иван"],
    ["Zhanar Mussina", "Zhanar"],
    ["Mussina Zhanar", "Zhanar"],
    ["Сидорова Марина", "Марина"],
    ["Марина Ильина", "Марина"],
    ["Нуртазина Айгерим", "Айгерим"],
    ["Ахметов Ерлан Серікұлы", "Ерлан"],
    ["John Smith", "John"],
    ["ОСПАНОВ ДАНИЯР", "Данияр"],
    ["Иван", "Иван"],
    ["  ", ""],
  ])("%s → %s", (fullName, expected) => {
    expect(firstNameOf(fullName)).toBe(expected);
  });
});
