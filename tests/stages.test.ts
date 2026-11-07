import { describe, expect, it } from "vitest";
import {
  DEFAULT_STAGES,
  insertIndexForNewStage,
  moveInOrder,
  nextProgressStage,
} from "@/lib/stages";

// Этапы по умолчанию плюс свой этап компании (key пустой) после скрининга.
const stages = DEFAULT_STAGES.map((stage, index) => ({ id: `s${index}`, key: stage.key }));
const custom = { id: "test", key: null };
const withCustom = [...stages.slice(0, 3), custom, ...stages.slice(3)];

describe("Следующий этап после интервью", () => {
  it("идёт по порядку из настроек и не пропускает свой этап", () => {
    // s2 — «Скрининг», за ним стоит «Тестовое задание»
    expect(nextProgressStage(withCustom, "s2")?.id).toBe("test");
    expect(nextProgressStage(withCustom, "test")?.id).toBe("s3");
  });

  it("после оффера дальше не ведёт", () => {
    expect(nextProgressStage(stages, "s5")).toBeNull();
  });

  it("из паузы и отказа дальше не ведёт", () => {
    const thinking = stages.find((stage) => stage.key === "CANDIDATE_THINKING")!;
    const declined = stages.find((stage) => stage.key === "WE_DECLINED")!;
    expect(nextProgressStage(stages, thinking.id)).toBeNull();
    expect(nextProgressStage(stages, declined.id)).toBeNull();
  });
});

describe("Куда встаёт новый этап", () => {
  it("после оффера, перед отказами и паузами", () => {
    expect(insertIndexForNewStage(stages)).toBe(6);
  });

  it("в пустом списке — первым", () => {
    expect(insertIndexForNewStage([])).toBe(0);
  });
});

describe("Перестановка этапов", () => {
  it("меняет местами с соседом", () => {
    expect(moveInOrder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("на краю двигать некуда", () => {
    expect(moveInOrder(["a", "b"], "a", "up")).toBeNull();
    expect(moveInOrder(["a", "b"], "b", "down")).toBeNull();
    expect(moveInOrder(["a", "b"], "x", "up")).toBeNull();
  });
});
