import { describe, expect, it } from "vitest";
import { JobPriority } from "@/generated/prisma/enums";
import { JOB_PRIORITIES, jobPriority } from "@/lib/job-priority";
import { JOB_PRIORITY_LABELS } from "@/lib/labels";
import { jobSchema } from "@/lib/validation";

describe("Приоритет вакансии", () => {
  // Сортировка вакансий в списке опирается на порядок значений
  // в перечислении базы: orderBy priority asc выдаёт их именно в том
  // порядке, в каком они объявлены в схеме. Если кто-то переставит
  // значения в схеме или в списке для интерфейса — срочные вакансии
  // молча перестанут быть первыми, и заметить это глазами трудно.
  it("порядок в интерфейсе совпадает с порядком в базе", () => {
    expect(JOB_PRIORITIES.map((item) => item.value)).toEqual(
      Object.keys(JobPriority),
    );
  });

  it("сначала самый срочный", () => {
    expect(JOB_PRIORITIES[0].value).toBe("HIGH");
  });

  it("у каждого значения есть название и пояснение", () => {
    for (const item of JOB_PRIORITIES) {
      expect(item.label).toBe(JOB_PRIORITY_LABELS[item.value]);
      expect(item.hint.length).toBeGreaterThan(5);
    }
  });

  it("находит приоритет по значению", () => {
    expect(jobPriority("LOW")?.label).toBe("Фоновый");
  });

  const form = {
    title: "Менеджер по продажам",
    description: "",
    requirements: "",
    salaryMin: null,
    salaryMax: null,
    currency: "KZT",
    status: "OPEN",
    recruiterId: null,
    hiringManagerId: null,
  };

  it("форма принимает все три приоритета", () => {
    for (const value of Object.keys(JobPriority)) {
      expect(jobSchema.safeParse({ ...form, priority: value }).success).toBe(
        true,
      );
    }
  });

  it("форма не принимает выдуманный приоритет", () => {
    // Подставить своё значение через форму нельзя: zod отсечёт его
    // до того, как оно дойдёт до базы.
    expect(jobSchema.safeParse({ ...form, priority: "URGENT" }).success).toBe(
      false,
    );
  });
});
