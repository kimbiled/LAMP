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
  description: string | null;
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
  birthDate: string | null;
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
  "Астана",
  "Нур-Султан",
  "Алматы",
  "Шымкент",
  "Караганда",
  "Актобе",
  "Тараз",
  "Павлодар",
  "Усть-Каменогорск",
  "Семей",
  "Атырау",
  "Костанай",
  "Кызылорда",
  "Уральск",
  "Петропавловск",
  "Актау",
  "Темиртау",
  "Туркестан",
  "Кокшетау",
  "Талдыкорган",
  "Экибастуз",
  "Рудный",
  "Жезказган",
  "Балхаш",
  "Жанаозен",
  "Кентау",
  "Сатпаев",
  "Риддер",
  "Степногорск",
  "Щучинск",
  "Аксай",
  "Аксу",
  "Байконур",
  "Каскелен",
  "Талгар",
  "Капшагай",
  "Конаев",
  "Арыс",
  "Житикара",
  "Лисаковск",
  "Аркалык",
  "Зыряновск",
  "Текели",
  "Ушарал",
  "Сарань",
  "Шахтинск",
  "Курчатов",
  "Форт-Шевченко",
  "Хромтау",
  "Шалкар",
  "Атбасар",
  "Макинск",
  "Москва",
  "Санкт-Петербург",
  "Новосибирск",
  "Екатеринбург",
  "Казань",
  "Бишкек",
  "Ош",
  "Ташкент",
  "Самарканд",
  "Душанбе",
  "Минск",
  "Киев",
  "Тбилиси",
  "Ереван",
  "Баку",
  "Дубай",
  "Стамбул",
  "Варшава",
  "Берлин",
];

// Месяц в любом написании: «Январь», «января», «янв.», «сен».
// В дизайнерских резюме почти всегда сокращения с точкой.
// Английские тоже: hh умеет отдавать резюме на английском,
// и тогда в датах стоит «September», «Feb.».
const MONTHS =
  "(?:(?:янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек)[а-яё]*|" +
  "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\\.?";

// Строка, в которой нет ничего, кроме названия месяца. В английской
// выгрузке с hh месяц и год попадают в разные строки, между ними
// вклинивается название компании.
const MONTH_ALONE = new RegExp(`^${MONTHS}$`, "i");
const STARTS_YEAR_RANGE = /^\d{4}\s*[—–-]/;

// Важно: в JavaScript граница слова \b не работает с кириллицей,
// поэтому вместо неё используем «дальше не идёт буква».
const END = "(?![а-яёa-z])";

const SECTIONS: { key: string; pattern: RegExp }[] = [
  // Разделы, которые нам не нужны, но которые обязаны закрыть
  // предыдущий. Стоят первыми: «Опыт вождения» иначе совпадает
  // с «опыт» и открывает раздел опыта работы заново — и тогда
  // «Имеется собственный автомобиль» и служебные блоки hh
  // («История общения с кандидатом», «Отклики») попадают
  // в описание последнего места работы.
  {
    key: "other",
    pattern: new RegExp(
      `^(опыт вождения|driving experience|история общения с кандидатом|отклики|комментарии|рекомендации|recommendations|портфолио|portfolio)${END}`,
      "i",
    ),
  },
  {
    key: "experience",
    pattern: new RegExp(
      `^(опыт работы|опыт|профессиональный опыт|work experience|experience|employment)${END}`,
      "i",
    ),
  },
  {
    key: "skills",
    pattern: new RegExp(
      `^(ключевые навыки|профессиональные навыки|навыки и инструменты|навыки|skills|tools|technical skills)${END}`,
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
    pattern: new RegExp(
      `^(образование|высшее образование|education)${END}`,
      "i",
    ),
  },
  {
    key: "about",
    pattern: new RegExp(
      `^(обо мне|о себе|дополнительная информация|about me|summary|профессиональное резюме|further information)${END}`,
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
      `^(сертификаты|курсы|повышение квалификации|certificates|courses)${END}`,
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
    birthDate: findBirthDate(text),
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

// Заголовки в дизайнерских резюме часто набраны вразрядку:
// «О П Ы Т  Р А Б О Т Ы». При чтении PDF это приходит как строка
// из отдельных букв, и обычный шаблон её не узнаёт. Поэтому заголовок
// проверяем дважды: как есть и без единого пробела.
function despace(line: string): string {
  return line.replace(/\s+/g, "");
}

const SECTIONS_TIGHT = SECTIONS.map((section) => ({
  key: section.key,
  pattern: new RegExp(despace(section.pattern.source), "i"),
}));

function splitIntoSections(lines: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  let current: string | null = null;

  for (const line of lines) {
    const short = line.length < 60;
    const matched =
      (short && SECTIONS.find((section) => section.pattern.test(line))) ||
      (short &&
        SECTIONS_TIGHT.find((section) => section.pattern.test(despace(line))));

    if (matched) {
      current = matched.key;
      if (!result[current]) result[current] = [];

      // В выгрузке hh заголовок и первая запись стоят в одной строке:
      // «Знание языков Казахский — Родной». Без этого казахский
      // уходил вместе с заголовком. Опыт работы не трогаем: там после
      // заголовка стоит общий стаж «— 3 года 8 месяцев», а не запись.
      const head = matched.pattern.exec(line);
      const rest = head
        ? line.slice(head[0].length).replace(/^[\s:—–-]+/, "").trim()
        : "";
      if (rest && current !== "experience") {
        result[current].push(rest);
      }
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
  // Перед меткой обязательно не-буква. Без этой проверки «tg» находилось
  // внутри слова PostgreSQL, и у каждого, кто его упомянул, появлялся
  // выдуманный ник @reSQL. После метки обязателен разделитель или @:
  // иначе меткой становится начало любого слова на «tg».
  const labelled = text.match(
    /(?<![\p{L}\p{N}])(?:telegram|телеграм|телеграмм|tg)(?:\s*[:\-—]\s*|\s+|\s*@)@?([A-Za-z0-9_]{4,32})/iu,
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
  /резюме|опыт|навыки|образование|контакт|телефон|работа|проект|компани|должност|зарплат|гражданств|мужчина|женщина|проживает|resume|experience|education|skills|contact|phone|email|position|salary|male|female|desired|citizenship|reside|specializations|employment/i;

// Названия должностей латиницей похожи на имена: «Sales Manager» —
// два слова с заглавных букв, как «Bekenov Rustam». Отличаем словарём.
const JOB_WORDS =
  /\b(manager|developer|engineer|analyst|designer|specialist|director|lead|head|senior|junior|middle|officer|consultant|assistant|coordinator|administrator|accountant|lawyer|driver|operator|support|product|project|marketing|sales|recruiter|architect|tester|intern|expert|advisor|planner|buyer|editor|writer|teacher|trainer|chief|owner|founder|partner|agent|broker|analyst|developer)\b/i;

// Буквы, из которых состоят имена. Кроме русских нужны казахские —
// Әбдіқан, Мейірлан, Қали — и латиница: hh отдаёт резюме и на английском.
const UPPER = "А-ЯЁӘҒҚҢӨҰҮҺІA-Z";
const LOWER = "а-яёәғқңөұүһіa-z";

const NAME_LINE = new RegExp(
  `^[${UPPER}][${LOWER}'-]+(?:\\s+[${UPPER}][${LOWER}'-]+){1,2}$`,
);

// Отчество: русское (-ович, -евна…), казахское (-ұлы, -қызы)
// и латиницей (-uly, -kyzy, -ovich).
const PATRONYMIC = new RegExp(
  `^[${UPPER}][${LOWER}'-]+(?:ович|евич|ьич|овна|евна|ична|инична|ұлы|улы|уулу|қызы|кызы|uly|ulu|kyzy|qyzy|ovich|evich|ovna|evna)$`,
);

function findFullName(lines: string[]): string | null {
  const labelled = lines.find((line) => /^(фио|ф\.и\.о)/i.test(line));
  if (labelled) {
    const value = labelled.replace(/^(фио|ф\.и\.о\.?)\s*[:\-]?\s*/i, "").trim();
    if (value.length > 3) return value;
  }

  // Обычно ФИО стоит в самом начале отдельной строкой.
  const head = lines.slice(0, 15);
  for (const [index, line] of head.entries()) {
    if (NAME_STOP_WORDS.test(line)) continue;
    if (JOB_WORDS.test(line)) continue;
    if (NAME_LINE.test(line)) {
      // hh набирает ФИО крупно, и отчество переносится на вторую
      // строку: «Мейрамбеков Нұрсұлтан» + «Миржанұлы». Подклеиваем,
      // если в имени два слова, а следующая строка — одно слово
      // с окончанием отчества.
      const next = head[index + 1];
      if (
        line.split(/\s+/).length === 2 &&
        next &&
        PATRONYMIC.test(next)
      ) {
        return `${line} ${next}`;
      }
      return line;
    }
  }

  return null;
}

const MONTH_NAMES = [
  "январ",
  "феврал",
  "март",
  "апрел",
  "ма",
  "июн",
  "июл",
  "август",
  "сентябр",
  "октябр",
  "ноябр",
  "декабр",
];

const ENGLISH_MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

// «родился 12 марта 1994», «Дата рождения: 12.03.1994»
function findBirthDate(text: string): string | null {
  // «родился», «родилась», «родились» — [а-яё] вместо перечисления букв:
  // здесь легко перепутать русскую «а» с латинской, и тогда ничего
  // не находится. Так уже было.
  const words = text.match(
    /(?:родил[а-яё]{0,3}|дата рождения)\s*[:\-—]?\s*(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i,
  );

  if (words) {
    const monthIndex = MONTH_NAMES.findIndex((name) =>
      words[2].toLowerCase().startsWith(name),
    );
    if (monthIndex >= 0) {
      const day = words[1].padStart(2, "0");
      const month = String(monthIndex + 1).padStart(2, "0");
      return `${words[3]}-${month}-${day}`;
    }
  }

  const digits = text.match(
    /(?:родил[а-яё]{0,3}|дата рождения|date of birth)\s*[:\-—]?\s*(\d{2})[.\/](\d{2})[.\/](\d{4})/i,
  );

  if (digits) {
    return `${digits[3]}-${digits[2]}-${digits[1]}`;
  }

  // Английская выгрузка с hh: «Male, 22 years, born on 26 August 2004».
  const english = text.match(/born\s+on\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);

  if (english) {
    const monthIndex = ENGLISH_MONTHS.findIndex((name) =>
      english[2].toLowerCase().startsWith(name),
    );
    if (monthIndex >= 0) {
      const day = english[1].padStart(2, "0");
      const month = String(monthIndex + 1).padStart(2, "0");
      return `${english[3]}-${month}-${day}`;
    }
  }

  return null;
}

function findCity(text: string): string | null {
  const labelled = text.match(
    /(?:проживает|проживание|город|местоположение|адрес|местожительство)\s*[:\-—]?\s*([А-ЯЁ][а-яё-]+(?:[ -][А-ЯЁ][а-яё-]+)?)/i,
  );
  if (labelled) return labelled[1];

  // «г. Жанаозен», «город Кентау» — так пишут про города,
  // которых нет и не может быть ни в каком списке.
  const prefixed = text.match(
    /(?:^|[\s,;(])г(?:ор(?:од)?)?\.?\s+([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)/,
  );
  if (prefixed) return prefixed[1];

  // Из знакомых городов берём тот, что встретился раньше всех: свой
  // город пишут в шапке, а чужие — дальше, в описании мест работы.
  let best: { city: string; at: number } | null = null;

  for (const city of CITIES) {
    const at = text.search(
      new RegExp(`(?<![А-Яа-яЁёA-Za-z])${city}${END}`, "i"),
    );
    if (at !== -1 && (!best || at < best.at)) {
      best = { city, at };
    }
  }

  return best?.city ?? null;
}

function findPosition(
  lines: string[],
  experienceLines: string[] | undefined,
): string | null {
  const labelled = lines.find((line) =>
    /^(желаемая должность|должность|позиция|специальность)\s*[:\-—]/i.test(
      line,
    ),
  );
  if (labelled) {
    const value = labelled.replace(/^[^:\-—]+[:\-—]\s*/, "").trim();
    if (value.length > 2) return value.slice(0, 150);
  }

  // В выгрузке с hh это заголовок «Желаемая должность и зарплата»,
  // а сама должность стоит следующей строкой, без двоеточия.
  const headerIndex = lines.findIndex((line) =>
    /^желаемая должность/i.test(line),
  );
  if (headerIndex >= 0) {
    const next = lines[headerIndex + 1];
    if (next && next.length > 2 && next.length < 100 && !/^\d/.test(next)) {
      return next.slice(0, 150);
    }
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

// Слова, которыми описывают владение языком. Сами по себе это не языки.
// В резюме они стоят рядом с названием — «Казахский, разговорный уровень», —
// и при разбиении строки по запятой превращались в отдельный «язык».
// Если в резюме два языка с одинаковым уровнем, в карточке появлялись
// две одинаковые метки «разговорный уровень».
//
// Окончания перечислены явно: \b и \w с кириллицей не работают.
// Если встретится незнакомая формулировка — допишите её в этот список.
const LEVEL_WORDS = [
  "родн(?:ой|ым|ое)",
  "носитель(?: языка)?",
  "свободн(?:ый|ое|ая|о)",
  "разговорн(?:ый|ое|ая|о)",
  "базов(?:ый|ое|ая|ые|о)",
  "начальн(?:ый|ое|ая)",
  "средн(?:ий|ее|яя)",
  "выше среднего",
  "продвинут(?:ый|ое|ая)",
  "профессиональн(?:ый|ое|ая)",
  "техническ(?:ий|ое|ая)",
  "уверенн(?:ый|ое|ая|о)",
  "со словар[её]м",
  "чтение(?: со словар[её]м)?",
  "[abc][12]",
  "native",
  "mother tongue",
  "fluent",
  "basic",
  "beginner",
  "elementary",
  "pre[- ]?intermediate",
  "upper[- ]?intermediate",
  "intermediate",
  "advanced",
  "proficient",
  "conversational",
];

// После самого слова может идти «уровень», «владение» и подобное.
const LANGUAGE_LEVEL = new RegExp(
  `^(?:${LEVEL_WORDS.join("|")})(?: (?:уровень|уровня|уровнем|level|владение|владения|знание|знания))?$`,
  "i",
);

function findLanguages(lines: string[] | undefined): string[] {
  if (!lines) return [];

  const result: string[] = [];
  const seen = new Set<string>();
  // Чтобы не приписать два уровня одному языку.
  let lastHasLevel = false;

  for (const line of lines.slice(0, 8)) {
    for (const piece of line.split(/[,;•·|]/)) {
      const item = piece
        .trim()
        .replace(/^[—–-]+s*/, "")
        .trim();

      if (item.length === 0 || item.length > 50) continue;

      // Уровень проверяем до ограничения по длине: «B2» короче трёх букв,
      // но это осмысленная запись, а не мусор.
      if (LANGUAGE_LEVEL.test(item)) {
        // Приписываем к языку, который шёл перед ним. Если языка ещё
        // не было — отбрасываем: «разговорный уровень» сам по себе
        // в карточке бесполезен.
        if (result.length > 0 && !lastHasLevel) {
          const level = /^[abc][12]$/i.test(item)
            ? item.toUpperCase()
            : item.toLowerCase();
          result[result.length - 1] += ` — ${level}`;
          lastHasLevel = true;
        }
        continue;
      }

      if (item.length < 3) continue;

      // Повторы отбрасываем без учёта регистра: «Русский» и «русский» —
      // один язык. Остаётся написание, которое встретилось первым.
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      result.push(item);
      lastHasLevel = false;

      if (result.length >= 10) return result;
    }
  }

  return result;
}

// ---------- места работы ----------

const PERIOD_START = `(?:(?:${MONTHS})\\s+\\d{4}|\\d{2}[./]\\d{4}|\\d{4})`;
const PERIOD_END = `(?:(?:${MONTHS})\\s+\\d{4}|\\d{2}[./]\\d{4}|\\d{4}|настоящее время|по настоящее время|сейчас|till now|present|to date)`;

const PERIOD = new RegExp(`^${PERIOD_START}\\s*[—–-]\\s*${PERIOD_END}`, "i");

// В выгрузках с сайтов вакансий период часто переносится на две строки:
//   «Июнь 2023 —»          + «Сентябрь 2026»
//   «Март 2023 — Май»      + «2023»
// Склеиваем такие пары обратно в одну строку.
const ENDS_WITH_DASH = /[—–-]\s*$/;
const ENDS_WITH_DASH_AND_MONTH = new RegExp(`[—–-]\\s*(?:${MONTHS})\\s*$`, "i");
// Важно: \b здесь нельзя — период часто заканчивается словами
// «настоящее время», а граница слова с кириллицей не работает.
const STARTS_PERIOD_END = new RegExp(`^${PERIOD_END}${END}`, "i");
const IS_YEAR = /^\d{4}$/;
const STARTS_PERIOD = new RegExp(`^${PERIOD_START}${END}`, "i");
// Строка, в которой нет ничего, кроме окончания периода: «сейчас», «Июн 2025».
const PERIOD_END_ONLY = new RegExp(`^${PERIOD_END}\\s*$`, "i");

function joinWrappedPeriods(lines: string[]): string[] {
  const result: string[] = [];
  // Строки, которые уже приклеили к месяцу выше по тексту.
  const used = new Set<number>();

  for (let index = 0; index < lines.length; index++) {
    if (used.has(index)) continue;

    const line = lines[index];
    const next = lines[index + 1];

    // Одинокий месяц: год к нему приезжает через строку-другую,
    // между ними стоит название компании. Ищем год поблизости
    // и собираем период обратно.
    if (MONTH_ALONE.test(line)) {
      const at = [1, 2, 3]
        .map((step) => index + step)
        .find(
          (candidate) =>
            lines[candidate] && STARTS_YEAR_RANGE.test(lines[candidate]),
        );

      if (at !== undefined) {
        result.push(`${line} ${lines[at]}`.replace(/\s+/g, " "));
        used.add(at);
        continue;
      }
    }

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

      // Второй случай: между началом и концом периода вклинилось
      // название компании. Так выглядит новая выгрузка с hh:
      //   «Июл 2025 –» + «AMANBAY TECH» + «сейчас»
      // Собираем период в одну строку, компанию ставим следующей.
      const afterNext = lines[index + 2];
      if (
        endsWithDash &&
        afterNext &&
        !STARTS_PERIOD_END.test(next) &&
        PERIOD_END_ONLY.test(afterNext)
      ) {
        result.push(`${line} ${afterNext}`.replace(/\s+/g, " "));
        result.push(next);
        index += 2;
        continue;
      }

      // Третий случай: период и название компании стоят в одной строке
      // рядом («Январь 2025 — Okori Kazakhstan»), а окончание периода
      // перенесено ниже («настоящее время»). Так свёрстан PDF с hh.
      // Разделяем обратно: период отдельно, компания отдельно.
      const tail = line.replace(STARTS_PERIOD, "").replace(/^\s*[—–-]\s*/, "");

      if (
        endsWithDash === false &&
        tail !== "" &&
        !STARTS_PERIOD_END.test(tail) &&
        /[—–-]/.test(line) &&
        STARTS_PERIOD_END.test(next)
      ) {
        const start = line.slice(0, line.length - tail.length).trim();
        result.push(`${start} ${next}`.replace(/\s+/g, " "));
        result.push(tail);
        index++;
        continue;
      }
    }

    result.push(line);
  }

  return result;
}

// [а-яё]* вместо \w*: \w в JavaScript не включает кириллицу.
// «мес» без окончания — так пишет новая выгрузка hh: «1 год 4 мес».
const DURATION =
  /^\d+\s*(?:год[а-яё]*|лет|мес[а-яё]*\.?|years?|months?)(?:\s+\d+\s*(?:мес[а-яё]*\.?|months?))?$/i;

// Иногда длительность стоит не отдельной строкой, а прилипает к должности:
// «2 года 1 месяц Менеджер по продажам». Отрезаем её от начала строки.
const LEADING_DURATION =
  /^\d+\s*(?:год[а-яё]*|лет|мес[а-яё]*\.?|years?|months?)(?:\s+\d+\s*(?:мес[а-яё]*\.?|months?))?\s+/i;

// Строки вида «Астана, kcell.kz» или просто «Алматы» — это адрес компании,
// а не должность. Такие строки пропускаем.
const NOISE =
  /(^https?:\/\/|^www\.|\b[a-z0-9-]+\.(ru|kz|com|net|org|io|kg|uz)\b)/i;

// В английской выгрузке города пишут латиницей, и без этого списка
// «Astana» попадает в должность вместо того, чтобы быть отброшенной.
const LATIN_CITIES = [
  "astana",
  "almaty",
  "shymkent",
  "karaganda",
  "aktobe",
  "taraz",
  "pavlodar",
  "atyrau",
  "kostanay",
  "aktau",
  "semey",
  "oral",
  "uralsk",
  "kyzylorda",
  "petropavlovsk",
  "kokshetau",
  "turkestan",
  "moscow",
  "bishkek",
  "tashkent",
  "minsk",
  "dubai",
  "tbilisi",
  "baku",
  "yerevan",
];

// hh иногда пишет вместо города страну: «Казахстан». Без этого списка
// страна становится должностью.
const COUNTRIES = [
  "казахстан",
  "kazakhstan",
  "россия",
  "russia",
  "узбекистан",
  "uzbekistan",
  "кыргызстан",
  "киргизия",
  "kyrgyzstan",
  "беларусь",
  "belarus",
  "грузия",
  "georgia",
  "оаэ",
  "uae",
];

function isLocationLine(line: string): boolean {
  const cleaned = line
    .replace(/[.,;]$/, "")
    .trim()
    .toLowerCase();

  return (
    CITIES.some((city) => cleaned === city.toLowerCase()) ||
    LATIN_CITIES.includes(cleaned) ||
    COUNTRIES.includes(cleaned)
  );
}

// Колонтитулы страниц PDF: hh печатает внизу каждой страницы
// «Иванов Иван • Резюме обновлено 14 сентября 2026 в 14:45»
// и номер «1/3». Они разрывают описание обязанностей посередине.
const PAGE_NOISE = [
  /резюме обновлено\s+\d/i,
  /resume updated\s/i,
  /^\d{1,2}\s*\/\s*\d{1,2}$/,
  /^(страница|page)\s+\d+(\s+(из|of)\s+\d+)?$/i,
];

function isPageNoise(line: string): boolean {
  return PAGE_NOISE.some((pattern) => pattern.test(line));
}

// Обязанности в резюме перечисляют через тире.
// Звёздочка — тоже обязанность: так их оформляет выгрузка с hh.
const IS_DUTY = /^[-–—*]\s*\S/;

// Отрасли компании hh перечисляет через точки-маркеры — это не должность.
const IS_MARKER = /^[•·]\s*\S/;

// Любой маркер пункта списка — его срезаем, в карточке точки рисуются сами.
const BULLET = /^[-–—*•·▪●◦■]\s*/;

// Строка с перечислением отраслей компании: длинная, через запятые.
// В выгрузках с сайтов вакансий она стоит между названием и должностью.
function looksLikeIndustryList(line: string): boolean {
  const commas = (line.match(/,/g) ?? []).length;
  return line.length > 55 && commas >= 2;
}

// Хвост перенесённой строки: «…организация» + «выставок».
// Название должности так не выглядит — оно начинается с заглавной буквы
// или с латиницы, а не с маленькой русской.
function looksLikeWrappedTail(line: string): boolean {
  return /^[а-яё]/.test(line);
}

// Строка написана целиком заглавными: «КГУ ЖАСЫЛ АЛМАТЫ».
// Строчных букв нет вовсе, а заглавных — хотя бы несколько.
function isShouting(line: string): boolean {
  return !/[а-яёa-z]/.test(line) && (line.match(/[А-ЯЁA-Z]/g) ?? []).length > 3;
}

// Нумерованный пункт: «1 - …», «2. …», «3) …».
const NUMBERED = /^\d{1,2}\s*[-–—.)]\s+\S/;

// Перечень технологий через точки: «React · TypeScript · Zustand».
function isTechStack(line: string): boolean {
  return (line.match(/\s·\s/g) ?? []).length >= 2;
}

// Строка-подзаголовок внутри описания: «Достижения:», «Обязанности:».
function isInlineHeading(line: string): boolean {
  return line.endsWith(":") && line.length < 50;
}

// PDF не знает, где кончается фраза: длинный пункт он просто
// переносит на следующую строку. Признаки того, что строка —
// продолжение предыдущей, а не новый пункт:
//   - начинается с маленькой буквы («…выдачи» + «ключей.»);
//   - предыдущая оборвана на запятой, скобке или переносе слова;
//   - предыдущая почти во всю ширину страницы и не закончена точкой.
function continuesPrevious(previous: string, line: string): boolean {
  if (/^[а-яёa-z]/.test(line)) return true;
  if (/[,(–-]$/.test(previous)) return true;
  return previous.length >= 70 && !/[.!?;:]$/.test(previous);
}

// Склейка слова, разорванного переносом: «бизнес-» + «процессов».
function joinWrapped(previous: string, line: string): string {
  return /[а-яёa-z]-$/i.test(previous)
    ? `${previous}${line}`
    : `${previous} ${line}`;
}

const DESCRIPTION_LIMIT = 5000;

// Описание обязанностей: всё, что стоит после должности.
// Раньше отсюда брались только строки с тире, а всё прочее
// выбрасывалось — и от пункта, перенесённого на две строки,
// оставалась половина. Теперь берём все строки и собираем
// из них пункты: один пункт — одна строка в результате.
function buildDescription(lines: string[]): string | null {
  // Где описание начинается, решает вызывающий; здесь только
  // отбрасываем служебные строки, которые могли остаться в начале.
  let start = 0;
  while (
    start < lines.length &&
    (DURATION.test(lines[start]) ||
      // Только короткая строка-адрес («Алматы neocode.kz»): длинная
      // строка с сайтом — это уже обязанность.
      (NOISE.test(lines[start]) &&
        lines[start].length < 40 &&
        !BULLET.test(lines[start])) ||
      isLocationLine(lines[start]))
  ) {
    start++;
  }

  const source = lines.slice(start);
  // Если пункты размечены маркерами, то строка без маркера
  // посреди списка — это хвост предыдущего пункта.
  // Номера сюда не входят: после «1. Стратегическое планирование»
  // идут обычные строки — это пункты раздела, а не хвост заголовка.
  const hasBullets = source.some(
    (line) => BULLET.test(line) && line.length > 2,
  );

  const items: { text: string; bullet: boolean }[] = [];

  for (const raw of source) {
    // Нумерованный пункт («1 - …») начинает новую строку, но номер
    // оставляем: в резюме бывает два уровня — проекты и пункты внутри.
    const isNumbered = NUMBERED.test(raw);
    const isBullet = BULLET.test(raw) && !isNumbered;
    const text = (isNumbered ? raw : raw.replace(BULLET, "")).trim();
    if (text.length === 0) continue;

    const last = items[items.length - 1];
    const continues =
      last !== undefined &&
      !isBullet &&
      !isNumbered &&
      !isInlineHeading(last.text) &&
      !isInlineHeading(text) &&
      // Стек технологий — всегда отдельная строка, и к нему ничего
      // не подклеивается: «Python 3.11 · FastAPI · Docker».
      !isTechStack(text) &&
      !isTechStack(last.text) &&
      ((hasBullets && last.bullet) || continuesPrevious(last.text, text));

    if (continues) {
      last.text = joinWrapped(last.text, text);
    } else {
      items.push({ text, bullet: isBullet });
    }
  }

  // Режем по целым пунктам, чтобы не обрывать фразу на полуслове.
  const kept: string[] = [];
  let length = 0;
  for (const item of items) {
    if (length + item.text.length + 1 > DESCRIPTION_LIMIT) break;
    kept.push(item.text);
    length += item.text.length + 1;
  }

  return kept.length > 0 ? kept.join("\n") : null;
}

// В выгрузке hh между компанией и должностью стоят отрасль
// и виды деятельности через «•»:
//   «Автомобильный бизнес»
//   «• Розничная торговля автомобилями (дилерский центр)»
//   «координатор по обучению персонала»   ← должность
// Возвращает номер строки сразу после списка — там должность.
// Если списка нет или после него ничего не осталось (значит,
// через «•» были перечислены обязанности), возвращает null.
function afterIndustryList(body: string[]): number | null {
  const first = body.findIndex((line) => IS_MARKER.test(line));
  if (first < 0 || first > 5) return null;

  let index = first + 1;
  while (index < body.length) {
    const line = body[index];
    const previous = body[index - 1];
    // Длинный вид деятельности переносится на вторую строку:
    // «…бизнес-процессов предприятия,» + «ИТ-консалтинг».
    // Хвост — это строка после запятой или строка с маленькой буквы
    // после строки во всю ширину. Должность после длинной отрасли
    // («Руководитель отдела продаж») начинается с заглавной — её не берём.
    const wrapped =
      /[,(–-]$/.test(previous) ||
      (previous.length >= 70 && /^[а-яёa-z]/.test(line));
    // Отраслей бывает несколько подряд: «Розничная торговля» + «• …»,
    // затем «Товары народного потребления» + «• …». Строка, за которой
    // снова идёт «•», — название следующей отрасли, а не должность.
    const nextIsMarker =
      index + 1 < body.length && IS_MARKER.test(body[index + 1]);
    if (IS_MARKER.test(line) || wrapped || nextIsMarker) {
      index++;
      continue;
    }
    break;
  }

  return index < body.length ? index : null;
}

// В дизайнерских резюме место работы описывают одной строкой через
// разделители, а период ставят следующей строкой:
//   «QA-инженер · JETI ASPAN · Астана»
//   «сен. 2025 – сен. 2026»
// Такая строка принадлежит следующему блоку, а не предыдущему.
const HEADER_LINE = /\s[·|—]\s/;

function findExperience(lines: string[] | undefined): ParsedExperience[] {
  if (!lines) return [];

  const blocks: { period: string; header: string | null; body: string[] }[] =
    [];

  const stream = joinWrappedPeriods(lines.filter((line) => !isPageNoise(line)));

  for (const [index, line] of stream.entries()) {
    if (PERIOD.test(line)) {
      // Строка перед периодом описывает не предыдущую работу, а ту,
      // период которой начинается сейчас. У первого блока предыдущего
      // блока нет — тогда смотрим прямо в поток строк.
      const previous = blocks[blocks.length - 1];
      const candidate = previous
        ? previous.body[previous.body.length - 1]
        : stream[index - 1];

      let header: string | null = null;
      if (
        candidate &&
        HEADER_LINE.test(candidate) &&
        !IS_DUTY.test(candidate)
      ) {
        header = candidate;
        previous?.body.pop();
      }

      blocks.push({ period: line, header, body: [] });
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].body.push(line);
    }
  }

  return blocks
    .slice(0, 8)
    .map((block): ParsedExperience | null => {
      // Если у блока есть строка-заголовок, она и содержит всё нужное:
      // должность, компанию и город через разделители. Разбираем её
      // и не гадаем по остальным строкам.
      if (block.header) {
        const parts = block.header
          .split(/\s[·|—]\s/)
          .map((part) => part.trim())
          .filter((part) => part.length > 1 && !isLocationLine(part));

        if (parts.length >= 2) {
          return {
            companyName: parts[1].slice(0, 150),
            position: parts[0].slice(0, 150),
            period: block.period,
            description: buildDescription(block.body),
          };
        }
      }

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
          !looksLikeIndustryList(line) &&
          !looksLikeWrappedTail(line),
      );
      if (!companyName) return null;

      // Строка, с которой начинается описание: всё, что после неё,
      // — обязанности. Запоминаем её до того, как отрежем от должности
      // длительность, чтобы потом найти в исходных строках блока.
      let positionLine: string | null = null;

      const industryEnd = afterIndustryList(body);
      if (industryEnd !== null) {
        // Выгрузка hh: должность стоит сразу после списка отраслей.
        // Она бывает и с маленькой буквы — «координатор по обучению».
        const line = body[industryEnd];
        if (!IS_DUTY.test(line) && !IS_MARKER.test(line) && line.length < 90) {
          positionLine = line;
        }
      } else {
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
            !looksLikeWrappedTail(line) &&
            !isInlineHeading(line) &&
            // Название должности короткое и без точек: «Media Planner»,
            // а не «Строю AI-агентов и интеграции для клиентов.»
            !/[.!?]\s/.test(line) &&
            line.length < 70,
        );

        // Сначала смотрим на строку, где должность стоит по раскладке:
        // прямо перед обязанностями или прямо после компании. Её берём
        // даже с маленькой буквы — в старых резюме hh пишут
        // «кассир - операционист, старший кассир».
        const companyIndex = body.indexOf(companyName);
        const expected =
          dutyIndex > 0 ? body[dutyIndex - 1] : body[companyIndex + 1];

        positionLine =
          expected &&
          expected !== companyName &&
          !IS_DUTY.test(expected) &&
          !IS_MARKER.test(expected) &&
          !looksLikeIndustryList(expected) &&
          !isInlineHeading(expected) &&
          // Конец предложения — точка и заглавная буква. «тех. поддержки»
          // — сокращение, такая должность годится.
          !/[.!?]\s+[А-ЯЁA-Z]/.test(expected) &&
          !/[.!?]$/.test(expected) &&
          expected.length < 80
            ? expected
            : dutyIndex > 0
              ? (candidates[candidates.length - 1] ?? null)
              : (candidates[0] ?? null);
      }

      let position: string | null = positionLine;

      if (position) {
        position = position.replace(LEADING_DURATION, "").trim() || null;
      }

      // Длинные названия организаций переносятся на вторую строку,
      // и та выглядит как должность. Признаков два: обе строки написаны
      // заглавными, либо в названии открылась кавычка «, а закрылась »
      // уже в следующей строке.
      let fullCompanyName = companyName;
      if (
        position &&
        ((isShouting(companyName) && isShouting(position)) ||
          (companyName.includes("«") &&
            !companyName.includes("»") &&
            position.includes("»")))
      ) {
        fullCompanyName = `${companyName} ${position}`;
        position = null;

        // Тогда должность — следующая строка после второй половины
        // названия: «АО «Центр … Национального» + «Банка РК»» + «Главный
        // инженер-программист».
        // Строку берём, только если за ней есть описание: последняя
        // строка блока — обычно отрасль («Государственные организации»).
        const tailIndex = positionLine ? body.indexOf(positionLine) : -1;
        const next = tailIndex >= 0 ? body[tailIndex + 1] : undefined;
        const afterNext = tailIndex >= 0 ? body[tailIndex + 2] : undefined;
        if (
          next &&
          afterNext !== undefined &&
          !IS_MARKER.test(afterNext) &&
          !IS_DUTY.test(next) &&
          !IS_MARKER.test(next) &&
          !isInlineHeading(next) &&
          !/[.!?]\s+[А-ЯЁA-Z]/.test(next) &&
          !/[.!?]$/.test(next) &&
          next.length < 80
        ) {
          position = next;
          positionLine = next;
        }
      }

      // Описание берём из исходных строк блока, а не из отфильтрованных:
      // фильтр выше выкидывает строки с адресами сайтов, а в обязанностях
      // они бывают («Запуск интернет-магазина shop.kz»).
      let descriptionFrom: number;
      if (positionLine) {
        descriptionFrom = block.body.indexOf(positionLine) + 1;
      } else {
        // Должности нет — начинаем после компании и пропускаем отрасли.
        descriptionFrom = block.body.indexOf(companyName) + 1;
        while (
          descriptionFrom < block.body.length &&
          (IS_MARKER.test(block.body[descriptionFrom]) ||
            looksLikeIndustryList(block.body[descriptionFrom]))
        ) {
          descriptionFrom++;
        }
      }

      return {
        companyName: fullCompanyName.slice(0, 150),
        position: position?.slice(0, 150) ?? null,
        period: block.period,
        description: buildDescription(block.body.slice(descriptionFrom)),
      };
    })
    .filter((item): item is ParsedExperience => item !== null);
}

// ---------- образование ----------

// Уровень образования — не вуз и не специальность.
const EDUCATION_LEVEL = new RegExp(
  `^(высшее|среднее|среднее специальное|специальное|неоконченное высшее|бакалавр|магистр|кандидат наук|доктор наук|higher|secondary|bachelor|master)${END}\\.?$`,
  "i",
);

function findEducation(lines: string[] | undefined): ParsedEducation[] {
  if (!lines) return [];

  const result: ParsedEducation[] = [];

  for (let index = 0; index < lines.length && result.length < 4; index++) {
    const line = lines[index];
    const yearMatch = line.match(/\b(19|20)\d{2}\b/);
    if (!yearMatch) continue;

    const institution = line.replace(/\b(19|20)\d{2}\b/g, "").trim();
    const nextLine = lines[index + 1];

    // Выгрузка hh: год отдельной строкой, ниже вуз, затем уровень
    // («Высшее») и специальность:
    //   «2027» + «AITU» + «Высшее» + «Информационные технологии, SE»
    if (institution.length <= 2 && nextLine) {
      let at = index + 2;
      while (
        at < lines.length &&
        (EDUCATION_LEVEL.test(lines[at]) || isPageNoise(lines[at]))
      ) {
        at++;
      }
      const specialty = lines[at];
      const usable =
        specialty !== undefined &&
        specialty.length < 200 &&
        !/\b(19|20)\d{2}\b/.test(specialty);

      result.push({
        institution: nextLine.slice(0, 200),
        specialty: usable ? specialty : null,
        years: yearMatch[0],
      });
      index = usable ? at : index + 1;
      continue;
    }

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
