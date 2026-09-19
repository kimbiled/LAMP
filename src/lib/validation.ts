import { z } from "zod";

// Правила проверки данных из форм.
// Эти проверки работают НА СЕРВЕРЕ: даже если кто-то обойдёт форму
// в браузере, некорректные данные в базу не попадут.

export const registerSchema = z
  .object({
    companyName: z
      .string()
      .min(2, "Название компании слишком короткое")
      .max(100, "Название компании слишком длинное"),
    fullName: z
      .string()
      .min(2, "Укажите имя и фамилию")
      .max(100, "Слишком длинное имя"),
    email: z.email("Введите корректный адрес почты"),
    password: z
      .string()
      .min(8, "Пароль должен быть не короче 8 символов")
      .max(200, "Слишком длинный пароль"),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Пароли не совпадают",
    path: ["passwordConfirm"],
  });

export const createUserSchema = z.object({
  fullName: z
    .string()
    .min(2, "Укажите имя и фамилию")
    .max(100, "Слишком длинное имя"),
  email: z.email("Введите корректный адрес почты"),
  password: z
    .string()
    .min(8, "Пароль должен быть не короче 8 символов")
    .max(200, "Слишком длинный пароль"),
  role: z.enum(["ADMIN", "RECRUITER", "HIRING_MANAGER"], {
    message: "Выберите роль",
  }),
});

export const jobSchema = z
  .object({
    title: z
      .string()
      .min(2, "Укажите название вакансии")
      .max(150, "Слишком длинное название"),
    description: z.string().max(5000, "Слишком длинное описание"),
    requirements: z.string().max(5000, "Слишком длинные требования"),
    salaryMin: z
      .number()
      .int()
      .min(0, "Зарплата не может быть отрицательной")
      .max(1_000_000_000, "Слишком большое число")
      .nullable(),
    salaryMax: z
      .number()
      .int()
      .min(0, "Зарплата не может быть отрицательной")
      .max(1_000_000_000, "Слишком большое число")
      .nullable(),
    currency: z.string().min(1).max(8),
    status: z.enum(["OPEN", "PAUSED", "CLOSED"], {
      message: "Выберите статус",
    }),
    recruiterId: z.string().nullable(),
    hiringManagerId: z.string().nullable(),
  })
  .refine(
    (data) =>
      data.salaryMin === null ||
      data.salaryMax === null ||
      data.salaryMax >= data.salaryMin,
    {
      message: "Верхняя граница не может быть меньше нижней",
      path: ["salaryMax"],
    },
  );

export const companySettingsSchema = z.object({
  name: z
    .string()
    .min(2, "Название компании слишком короткое")
    .max(100, "Название компании слишком длинное"),
});

export const loginSchema = z.object({
  email: z.email("Введите корректный адрес почты"),
  password: z.string().min(1, "Введите пароль"),
});

// Превращает список ошибок проверки в простой список «поле → сообщение».
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!result[field]) {
      result[field] = issue.message;
    }
  }
  return result;
}
