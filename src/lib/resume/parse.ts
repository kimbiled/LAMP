// Распознавание данных из текста резюме.
//
// Здесь нет искусственного интеллекта — только правила и шаблоны.
// Контакты (телефон, почта, Telegram) находятся почти всегда,
// ФИО и город — обычно, опыт и образование — как повезёт:
// резюме бывают очень разными по оформлению.
// Поэтому рекрутер обязательно проверяет результат перед сохранением.

export type ParsedExperience = {
  companyName: string;
  position: string | null;
  period: string | null;
};

export type ParsedEducation = {
  institution: string;
  specialty: string | null;
  years: string | null;
};

export type ParsedResume = {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  city: string | null;
  currentPosition: string | null;
  experienceYears: number | null;
  salaryExpectation: number | null;
  currency: string | null;
  skills: string[];
  languages: string[];
  experience: ParsedExperience[];
  education: ParsedEducation[];
};

const CITIES = [
  "Астана", "Нур-Султан", "Алматы", "Шымкент", "Караганда", "Актобе",
  "Тараз", "Павлодар", "Усть-Каменогорск", "Семей", "Атырау", "Костанай",
  "Кызылорда", "Уральск", "Петропавловск", "Актау", "Темиртау", "Туркестан",
  "Кокшетау", "Талдыкорган", "Экибастуз", "Рудный", "Жезказган", "Балхаш",
  "Москва", "Санкт-Петербург", "Новосибирск", "Екатеринбург", "Казань",
  "Бишкек", "Ташкент", "Минск", "Тбилиси", "Ереван", "Баку", "Дубай",
];

const MONTHS =
  "январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь";

// Важно: в JavaScript граница слова \b не работает с кириллицей,
// поэтому вместо неё используем «дальше не идёт буква».
const END = "(?![а-яёa-z])";

const SECTIONS: { key: string; pattern: RegExp }[] = [
  { key: "experience", pattern: new RegExp(`^опыт работы${END}`, "i") },
  {
    key: "skills",
    pattern: new RegExp(
      `^(ключевые навыки|профессиональные навыки|навыки|skills)${END}`,
      "i",
    ),
  },
  {
    key: "languages",
    pattern: new RegExp(
      `^(знание языков|владение языками|языки|languages)${END}`,
      "i",
    ),
  },
  {
    key: "education",
    pattern: new RegExp(`^(образование|высшее образование|education)${END}`, "i"),
  },
  {
    key: "about",
    pattern: new RegExp(
      `^(обо мне|о себе|дополнительная информация)${END}`,
      "i",
    ),
  },
  {
    key: "contacts",
    pattern: new RegExp(`^(контакты|контактная информация)${END}`, "i"),
  },
  {
    key: "certificates",
    pattern: new RegExp(
      `^(сертификаты|курсы|повышение квалификации)${END}`,
      "i",
    ),
  },
];

export function parseResume(text: string): ParsedResume {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const sections = splitIntoSections(lines);

  const email = findEmail(text);
  const phone = findPhone(text);

  return {
    fullName: findFullName(lines),
    phone,
    email,
    telegram: findTelegram(text, email),
    city: findCity(text),
    currentPosition: findPosition(lines, sections.experience),
    experienceYears: findExperienceYears(text),
    salaryExpectation: findSalary(text),
    currency: findCurrency(text),
    skills: findSkills(sections.skills),
    languages: findLanguages(sections.languages),
    experience: findExperience(sections.experience),
    education: findEducation(sections.education),
  };
}

// ---------- разбивка на разделы ----------

function splitIntoSections(lines: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  let current: string | null = null;

  for (const line of lines) {
    const matched = SECTIONS.find(
      (section) => line.length < 60 && section.pattern.test(line),
    );

    if (matched) {
      current = matched.key;
      if (!result[current]) result[current] = [];
      continue;
    }

    if (current) {
      result[current].push(line);
    }
  }

  return result;
}

// ---------- контакты ----------

function findEmail(text: string): string | null {
  const match = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

function findPhone(text: string): string | null {
  const match = text.match(
    /(?:\+?7|8)[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/,
  );
  if (!match) return null;

  const digits = match[0].replace(/\D/g, "");
  const normalized = digits.length === 11 ? `7${digits.slice(1)}` : digits;

  // Приводим к виду +7 701 123 45 67
  if (normalized.length === 11) {
    return `+${normalized[0]} ${normalized.slice(1, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 9)} ${normalized.slice(9)}`;
  }
  return match[0].trim();
}

function findTelegram(text: string, email: string | null): string | null {
  const labelled = text.match(
    /(?:telegram|телеграм|телеграмм|tg)\s*[:\-—]?\s*@?([A-Za-z0-9_]{4,32})/i,
  );
  if (labelled) return labelled[1];

  const bare = text.match(/(?:^|\s)@([A-Za-z0-9_]{5,32})\b/);
  if (bare && (!email || !email.includes(bare[1]))) {
    return bare[1];
  }

  return null;
}

// ---------- личные данные ----------

const NAME_STOP_WORDS =
  /резюме|опыт|навыки|образование|контакт|телефон|работа|проект|компани|должност|зарплат|гражданств/i;

function findFullName(lines: string[]): string | null {
  const labelled = lines.find((line) => /^(фио|ф\.и\.о)/i.test(line));
  if (labelled) {
    const value = labelled.replace(/^(фио|ф\.и\.о\.?)\s*[:\-]?\s*/i, "").trim();
    if (value.length > 3) return value;
  }

  // Обычно ФИО стоит в самом начале отдельной строкой.
  for (const line of lines.slice(0, 15)) {
    if (NAME_STOP_WORDS.test(line)) continue;
    if (/^[А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ][а-яё-]+){1,2}$/.test(line)) {
      return line;
    }
  }

  return null;
}

function findCity(text: string): string | null {
  const labelled = text.match(
    /(?:проживает|город|местоположение|адрес)\s*[:\-—]?\s*([А-ЯЁ][а-яё-]+(?:[ -][А-ЯЁ][а-яё-]+)?)/i,
  );
  if (labelled) return labelled[1];

  const found = CITIES.find((city) =>
    new RegExp(`(?<![А-Яа-яЁёA-Za-z])${city}${END}`, "i").test(text),
  );
  return found ?? null;
}

function findPosition(
  lines: string[],
  experienceLines: string[] | undefined,
): string | null {
  const labelled = lines.find((line) =>
    /^(желаемая должность|должность|позиция|специальность)\s*[:\-—]/i.test(line),
  );
  if (labelled) {
    const value = labelled.replace(/^[^:\-—]+[:\-—]\s*/, "").trim();
    if (value.length > 2) return value.slice(0, 150);
  }

  // Иначе берём должность с последнего места работы.
  const fromExperience = findExperience(experienceLines)[0]?.position;
  return fromExperience ?? null;
}

function findExperienceYears(text: string): number | null {
  const match = text.match(
    /опыт(?:\s+работы)?\s*[:\-—]?\s*(\d{1,2})\s*(?:год|года|лет)/i,
  );
  if (match) return Number(match[1]);

  const stage = text.match(/стаж\s*[:\-—]?\s*(\d{1,2})/i);
  return stage ? Number(stage[1]) : null;
}

function findSalary(text: string): number | null {
  const match = text.match(
    /(?:зарплат[а-яё]*|оклад|доход|ожидания)[^\d\n]{0,20}(\d[\d\s.]{3,12})/i,
  );
  if (!match) return null;

  const value = Number(match[1].replace(/[\s.]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function findCurrency(text: string): string | null {
  if (/₸|тенге|\bтг\b|KZT/i.test(text)) return "KZT";
  if (/₽|руб|RUB/i.test(text)) return "RUB";
  if (/\$|USD|долл/i.test(text)) return "USD";
  if (/€|EUR|евро/i.test(text)) return "EUR";
  return null;
}

// ---------- списки ----------

function findSkills(lines: string[] | undefined): string[] {
  if (!lines) return [];

  return lines
    .slice(0, 12)
    .flatMap((line) => line.split(/[,;•·|]/))
    .map((item) => item.trim())
    .filter((item) => item.length > 1 && item.length < 40)
    .slice(0, 30);
}

function findLanguages(lines: string[] | undefined): string[] {
  if (!lines) return [];

  return lines
    .slice(0, 8)
    .flatMap((line) => line.split(/[,;•·|]/))
    .map((item) => item.trim())
    .filter((item) => item.length > 2 && item.length < 50)
    .slice(0, 10);
}

// ---------- места работы ----------

const PERIOD_START = `(?:(?:${MONTHS})\\s+\\d{4}|\\d{2}[./]\\d{4}|\\d{4})`;
const PERIOD_END = `(?:(?:${MONTHS})\\s+\\d{4}|\\d{2}[./]\\d{4}|\\d{4}|настоящее время|по настоящее время|сейчас)`;

const PERIOD = new RegExp(`^${PERIOD_START}\\s*[—–-]\\s*${PERIOD_END}`, "i");

// В выгрузках с сайтов вакансий период часто переносится на две строки:
//   «Июнь 2023 —»          + «Сентябрь 2026»
//   «Март 2023 — Май»      + «2023»
// Склеиваем такие пары обратно в одну строку.
const ENDS_WITH_DASH = /[—–-]\s*$/;
const ENDS_WITH_DASH_AND_MONTH = new RegExp(`[—–-]\\s*(?:${MONTHS})\\s*$`, "i");
const STARTS_PERIOD_END = new RegExp(`^${PERIOD_END}\\b`, "i");
const IS_YEAR = /^\d{4}$/;
const STARTS_PERIOD = new RegExp(`^${PERIOD_START}\\b`, "i");

function joinWrappedPeriods(lines: string[]): string[] {
  const result: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const next = lines[index + 1];

    if (next && STARTS_PERIOD.test(line)) {
      const endsWithDash = ENDS_WITH_DASH.test(line);
      const endsWithMonth = ENDS_WITH_DASH_AND_MONTH.test(line);

      if (
        (endsWithDash && STARTS_PERIOD_END.test(next)) ||
        (endsWithMonth && IS_YEAR.test(next))
      ) {
        result.push(`${line} ${next}`.replace(/\s+/g, " "));
        index++;
        continue;
      }
    }

    result.push(line);
  }

  return result;
}

// [а-яё]* вместо \w*: \w в JavaScript не включает кириллицу.
const DURATION =
  /^\d+\s*(?:год[а-яё]*|лет|месяц[а-яё]*)(?:\s+\d+\s*месяц[а-яё]*)?$/i;

// Строки вида «Астана, kcell.kz» или просто «Алматы» — это адрес компании,
// а не должность. Такие строки пропускаем.
const NOISE = /(^https?:\/\/|^www\.|\b[a-z0-9-]+\.(ru|kz|com|net|org|io|kg|uz)\b)/i;

function isLocationLine(line: string): boolean {
  const cleaned = line.replace(/[.,;]$/, "").trim();
  return CITIES.some((city) => cleaned.toLowerCase() === city.toLowerCase());
}

// Обязанности в резюме перечисляют через тире.
const IS_DUTY = /^[-–—]\s*\S/;

// Отрасли компании перечисляют через точки-маркеры — это не должность.
const IS_MARKER = /^[•·*]\s*\S/;

// Строка с перечислением отраслей компании: длинная, через запятые.
// В выгрузках с сайтов вакансий она стоит между названием и должностью.
function looksLikeIndustryList(line: string): boolean {
  const commas = (line.match(/,/g) ?? []).length;
  return line.length > 55 && commas >= 2;
}

function findExperience(lines: string[] | undefined): ParsedExperience[] {
  if (!lines) return [];

  const blocks: { period: string; body: string[] }[] = [];

  for (const line of joinWrappedPeriods(lines)) {
    if (PERIOD.test(line)) {
      blocks.push({ period: line, body: [] });
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].body.push(line);
    }
  }

  return blocks
    .slice(0, 8)
    .map((block): ParsedExperience | null => {
      // Отсекаем то, что заведомо не является ни компанией, ни должностью.
      const body = block.body.filter(
        (line) =>
          !DURATION.test(line) &&
          !NOISE.test(line) &&
          !isLocationLine(line) &&
          line.length > 1,
      );

      const companyName = body.find(
        (line) =>
          !IS_DUTY.test(line) &&
          !IS_MARKER.test(line) &&
          !looksLikeIndustryList(line),
      );
      if (!companyName) return null;

      // Должность стоит последней строкой перед описанием обязанностей.
      const dutyIndex = body.findIndex((line) => IS_DUTY.test(line));

      const candidates = (
        dutyIndex > 0 ? body.slice(0, dutyIndex) : body
      ).filter(
        (line) =>
          line !== companyName &&
          !IS_DUTY.test(line) &&
          !IS_MARKER.test(line) &&
          !looksLikeIndustryList(line) &&
          line.length < 120,
      );

      const position =
        dutyIndex > 0
          ? (candidates[candidates.length - 1] ?? null)
          : (candidates[0] ?? null);

      return {
        companyName: companyName.slice(0, 150),
        position,
        period: block.period,
      };
    })
    .filter((item): item is ParsedExperience => item !== null);
}

// ---------- образование ----------

function findEducation(lines: string[] | undefined): ParsedEducation[] {
  if (!lines) return [];

  const result: ParsedEducation[] = [];

  for (let index = 0; index < lines.length && result.length < 4; index++) {
    const line = lines[index];
    const yearMatch = line.match(/\b(19|20)\d{2}\b/);
    if (!yearMatch) continue;

    const institution = line.replace(/\b(19|20)\d{2}\b/g, "").trim();
    const nextLine = lines[index + 1];

    result.push({
      institution:
        institution.length > 2 ? institution.slice(0, 200) : (nextLine ?? line),
      specialty:
        institution.length > 2 && nextLine && nextLine.length < 200
          ? nextLine
          : null,
      years: yearMatch[0],
    });
  }

  return result;
}
