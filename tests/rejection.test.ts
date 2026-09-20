import { describe, expect, it } from "vitest";
import {
  isKnownReason,
  reasonsFor,
  rejectionLabel,
  rejectionSide,
} from "@/lib/rejection";

// Причину спрашиваем ровно на двух этапах. Если сюда случайно попадёт
// обычный этап, рекрутер будет получать лишнее окно на каждом шаге.

describe("Причины отказа", () => {
  it("спрашиваются только на этапах отказа", () => {
    expect(rejectionSide("WE_DECLINED")).toBe("WE");
    expect(rejectionSide("CANDIDATE_DECLINED")).toBe("CANDIDATE");
    // Старый общий этап отказа — тоже наш отказ.
    expect(rejectionSide("REJECTED")).toBe("WE");
  });

  it("на рабочих этапах и паузах не спрашиваются", () => {
    expect(rejectionSide("NEW")).toBeNull();
    expect(rejectionSide("SCREENING")).toBeNull();
    expect(rejectionSide("OFFER")).toBeNull();
    expect(rejectionSide("NO_RESPONSE")).toBeNull();
    expect(rejectionSide("CANDIDATE_THINKING")).toBeNull();
    expect(rejectionSide(null)).toBeNull();
  });

  it("у каждой стороны свой список причин", () => {
    const we = reasonsFor("WE").map((item) => item.code);
    const candidate = reasonsFor("CANDIDATE").map((item) => item.code);

    expect(we).toContain("TEST_FAILED");
    expect(candidate).toContain("OTHER_OFFER");
    expect(we).not.toContain("OTHER_OFFER");
  });

  it("чужой код причины не принимается", () => {
    expect(isKnownReason("WE", "TEST_FAILED")).toBe(true);
    expect(isKnownReason("WE", "OTHER_OFFER")).toBe(false);
    expect(isKnownReason("CANDIDATE", "что-угодно")).toBe(false);
  });

  it("код превращается в человеческое название", () => {
    expect(rejectionLabel("SALARY")).toBeTruthy();
    expect(rejectionLabel("НЕТ_ТАКОГО")).toBeNull();
    expect(rejectionLabel(null)).toBeNull();
  });
});
