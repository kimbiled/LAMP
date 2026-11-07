import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";
import {
  candidateWhereFrom,
  filtersToQuery,
  readCandidateFilters,
} from "@/lib/candidate-filters";

describe("Таблица для Excel", () => {
  it("с меткой кодировки и точкой с запятой", () => {
    const csv = toCsv(["ФИО", "Город"], [["Тестов Тест", "Алматы"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("ФИО;Город\r\nТестов Тест;Алматы");
  });

  it("берёт в кавычки значения с разделителем и переносом", () => {
    expect(toCsv(["a"], [["1; 2"], ['он сказал "да"'], ["строка\nвторая"]])).toBe(
      '﻿a\r\n"1; 2"\r\n"он сказал ""да"""\r\n"строка\nвторая"\r\n',
    );
  });

  it("не даёт Excel выполнить формулу из резюме", () => {
    expect(toCsv(["a"], [["=HYPERLINK(1)"], ["+7 701 000 00 00"]])).toBe(
      "﻿a\r\n'=HYPERLINK(1)\r\n'+7 701 000 00 00\r\n",
    );
  });

  it("пустые значения — пустые ячейки", () => {
    expect(toCsv(["a", "b"], [[null, 5]])).toBe("﻿a;b\r\n;5\r\n");
  });
});

describe("Фильтры кандидатов", () => {
  const admin = { id: "u1", role: "ADMIN" as const, companyId: "c1" };
  const manager = { id: "u2", role: "HIRING_MANAGER" as const, companyId: "c1" };

  it("компания всегда из сессии, даже если её подсунули в адрес", () => {
    const filters = readCandidateFilters(
      new URLSearchParams("companyId=c2&job=j1&channel=WARM"),
    );
    expect(filters).toEqual({ job: "j1", channel: "WARM" });
    const where = candidateWhereFrom(filters, admin);
    expect(where.companyId).toBe("c1");
    expect(where.jobId).toBe("j1");
    expect(where.sourceChannel).toBe("WARM");
  });

  it("«без вакансии» ищет пустую вакансию", () => {
    expect(candidateWhereFrom({ job: "none" }, admin).jobId).toBeNull();
  });

  it("неизвестный канал игнорируется", () => {
    expect(candidateWhereFrom({ channel: "HACK" }, admin).sourceChannel).toBeUndefined();
  });

  it("менеджер и в выгрузке видит только своих", () => {
    expect(candidateWhereFrom({}, manager).AND).toBeDefined();
    expect(candidateWhereFrom({}, admin).AND).toBeUndefined();
  });

  it("адрес выгрузки повторяет фильтры", () => {
    expect(filtersToQuery({ q: "React", job: "", channel: "COLD" })).toBe(
      "?q=React&channel=COLD",
    );
    expect(filtersToQuery({})).toBe("");
  });
});
