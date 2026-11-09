import { describe, expect, it } from "vitest";
import {
  caseVariants,
  cyrillicToLatin,
  latinToCyrillic,
  searchVariants,
  swapLayout,
} from "@/lib/search-variants";

describe("варианты поиска", () => {
  it("исправляет раскладку в обе стороны", () => {
    expect(swapLayout("тфкшьфт")).toBe("nariman");
    expect(swapLayout("ghbdtn")).toBe("привет");
    expect(swapLayout("Ghjuhfvvbcn")).toBe("Программист");
  });

  it("транслит латиница → кириллица", () => {
    expect(latinToCyrillic("nariman")).toBe("нариман");
    expect(latinToCyrillic("Zhanar")).toBe("Жанар");
    expect(latinToCyrillic("Shakarim")).toBe("Шакарим");
  });

  it("транслит кириллица → латиница, с казахскими буквами", () => {
    expect(cyrillicToLatin("Нариман")).toBe("Nariman");
    expect(cyrillicToLatin("Жанар")).toBe("Zhanar");
    expect(cyrillicToLatin("Қуаныш")).toBe("Kuanysh");
  });

  it("nariman находит и Нариман", () => {
    expect(searchVariants("nariman")).toEqual(
      expect.arrayContaining(["nariman", "нариман"]),
    );
  });

  it("тфкшьфт (не та раскладка) — это и nariman, и нариман", () => {
    expect(searchVariants("тфкшьфт")).toEqual(
      expect.arrayContaining(["тфкшьфт", "nariman", "нариман"]),
    );
  });

  it("Жанар находит и Zhanar", () => {
    expect(searchVariants("Жанар")).toEqual(expect.arrayContaining(["Жанар", "Zhanar"]));
  });

  it("пустой запрос — пустой список, сам запрос всегда первый", () => {
    expect(searchVariants("  ")).toEqual([]);
    expect(searchVariants("excel")[0]).toBe("excel");
  });

  it("регистр навыков", () => {
    expect(caseVariants("excel")).toEqual(
      expect.arrayContaining(["excel", "Excel", "EXCEL"]),
    );
  });
});
