import { describe, expect, it } from "vitest";
import {
  can,
  candidateVisibilityFilter,
  jobVisibilityFilter,
} from "@/lib/permissions";

// Самая важная проверка в проекте: кто что может.
// Если кто-то случайно расширит права, тест это заметит.

describe("Права ролей", () => {
  it("администратор может всё ключевое", () => {
    expect(can("ADMIN", "users.manage")).toBe(true);
    expect(can("ADMIN", "company.manage")).toBe(true);
    expect(can("ADMIN", "candidates.delete")).toBe(true);
    expect(can("ADMIN", "jobs.delete")).toBe(true);
    expect(can("ADMIN", "stages.manage")).toBe(true);
    expect(can("ADMIN", "analytics.view")).toBe(true);
  });

  it("рекрутер ведёт подбор, но не управляет компанией", () => {
    expect(can("RECRUITER", "candidates.create")).toBe(true);
    expect(can("RECRUITER", "candidates.move")).toBe(true);
    expect(can("RECRUITER", "interviews.manage")).toBe(true);
    expect(can("RECRUITER", "share.create")).toBe(true);
    expect(can("RECRUITER", "analytics.view")).toBe(true);

    expect(can("RECRUITER", "users.manage")).toBe(false);
    expect(can("RECRUITER", "company.manage")).toBe(false);
    expect(can("RECRUITER", "candidates.delete")).toBe(false);
    expect(can("RECRUITER", "jobs.delete")).toBe(false);
    expect(can("RECRUITER", "stages.manage")).toBe(false);
  });

  it("нанимающий менеджер только оставляет фидбэк", () => {
    expect(can("HIRING_MANAGER", "feedback.create")).toBe(true);

    expect(can("HIRING_MANAGER", "candidates.create")).toBe(false);
    expect(can("HIRING_MANAGER", "candidates.edit")).toBe(false);
    expect(can("HIRING_MANAGER", "candidates.move")).toBe(false);
    expect(can("HIRING_MANAGER", "candidates.delete")).toBe(false);
    expect(can("HIRING_MANAGER", "candidates.viewAll")).toBe(false);
    expect(can("HIRING_MANAGER", "candidates.export")).toBe(false);
    expect(can("HIRING_MANAGER", "jobs.manage")).toBe(false);
    expect(can("HIRING_MANAGER", "jobs.viewAll")).toBe(false);
    expect(can("HIRING_MANAGER", "interviews.manage")).toBe(false);
    expect(can("HIRING_MANAGER", "users.manage")).toBe(false);
    expect(can("HIRING_MANAGER", "analytics.view")).toBe(false);
  });
});

describe("Видимость вакансий и кандидатов", () => {
  const admin = { id: "u1", role: "ADMIN" as const };
  const recruiter = { id: "u2", role: "RECRUITER" as const };
  const manager = { id: "u3", role: "HIRING_MANAGER" as const };

  it("администратор и рекрутер видят всё в своей компании", () => {
    expect(jobVisibilityFilter(admin)).toEqual({});
    expect(jobVisibilityFilter(recruiter)).toEqual({});
    expect(candidateVisibilityFilter(admin)).toEqual({});
    expect(candidateVisibilityFilter(recruiter)).toEqual({});
  });

  it("нанимающий менеджер ограничен своими вакансиями", () => {
    expect(jobVisibilityFilter(manager)).toEqual({ hiringManagerId: "u3" });
  });

  // Интервьюером назначают любого сотрудника, и ему приходит «Нужен отзыв».
  // Раньше менеджер чужой вакансии по этой ссылке получал «не найдено».
  it("менеджер видит кандидатов своих вакансий и тех, у кого он интервьюер", () => {
    expect(candidateVisibilityFilter(manager)).toEqual({
      AND: [
        {
          OR: [
            { job: { hiringManagerId: "u3" } },
            { interviews: { some: { interviewerId: "u3" } } },
          ],
        },
      ],
    });
  });
});
