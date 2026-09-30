import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";

// Написать фидбэк может любая роль — для нанимающего менеджера это
// основная работа. А править и удалять чужое мнение вправе только
// администратор: иначе неудобный отзыв можно тихо переписать.
describe("права на фидбэк", () => {
  it("писать фидбэк может любая роль", () => {
    expect(can("ADMIN", "feedback.create")).toBe(true);
    expect(can("RECRUITER", "feedback.create")).toBe(true);
    expect(can("HIRING_MANAGER", "feedback.create")).toBe(true);
  });

  it("править и удалять может только администратор", () => {
    expect(can("ADMIN", "feedback.manage")).toBe(true);
    expect(can("RECRUITER", "feedback.manage")).toBe(false);
    expect(can("HIRING_MANAGER", "feedback.manage")).toBe(false);
  });
});
