import { z } from "zod";

// Пароли, которые подбирают в первую очередь. Их запрещаем,
// даже если по длине они подходят.
const WEAK_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "qwerty123",
  "qwertyui",
  "11111111",
  "00000000",
  "iloveyou",
  "admin123",
  "parol123",
  "пароль123",
  "lamp1234",
]);

export function isWeakPassword(value: string): boolean {
  return WEAK_PASSWORDS.has(value.toLowerCase().trim());
}

const passwordField = z
  .string()
  .min(8, "Пароль должен быть не короче 8 символов")
  .max(200, "Слишком длинный пароль")
  .refine((value) => !isWeakPassword(value), {
    message: "Этот пароль слишком простой — его подбирают первым",
  });

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
    password: passwordField,
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
  password: passwordField,
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

export const candidateSchema = z.object({
  fullName: z
    .string()
    .min(2, "Укажите фамилию и имя")
    .max(150, "Слишком длинное имя"),
  jobId: z.string().nullable(),
  stageId: z.string().min(1, "Выберите этап"),
  phone: z.string().max(40, "Слишком длинный номер"),
  email: z.union([z.literal(""), z.email("Введите корректный адрес почты")]),
  city: z.string().max(100, "Слишком длинное название города"),
  birthDate: z
    .union([
      z.literal(""),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Проверьте дату рождения"),
    ]),
  currentPosition: z.string().max(150, "Слишком длинное название должности"),
  experienceYears: z
    .number()
    .int()
    .min(0, "Опыт не может быть отрицательным")
    .max(70, "Проверьте количество лет")
    .nullable(),
  salaryExpectation: z
    .number()
    .int()
    .min(0, "Сумма не может быть отрицательной")
    .max(1_000_000_000, "Слишком большая сумма")
    .nullable(),
  currency: z.string().min(1).max(8),
  telegram: z.string().max(64, "Слишком длинный ник"),
  skills: z.array(z.string()),
  languages: z.array(z.string()),
  source: z.string().max(100, "Слишком длинное значение"),
  note: z.string().max(5000, "Слишком длинный комментарий"),
});

export const interviewSchema = z.object({
  type: z.enum(["HR", "TECHNICAL", "MANAGER", "FINAL", "OTHER"], {
    message: "Выберите тип интервью",
  }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Укажите время"),
  durationMinutes: z.number().int().min(15).max(480).nullable(),
  interviewerId: z.string().nullable(),
  comment: z.string().max(2000, "Слишком длинный комментарий"),
});

export const feedbackSchema = z.object({
  stageId: z.string().nullable(),
  interviewId: z.string().nullable(),
  result: z.enum(["POSITIVE", "NEGATIVE", "EXTRA_STAGE"], {
    message: "Выберите результат",
  }),
  comment: z
    .string()
    .min(3, "Напишите хотя бы пару слов")
    .max(4000, "Слишком длинный комментарий"),
});

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
