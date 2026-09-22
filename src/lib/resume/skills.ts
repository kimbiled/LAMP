// Поиск навыков по словарю, без всякого искусственного интеллекта.
//
// Раньше навыки брались только из раздела «Ключевые навыки» выгрузки
// с hh. Если человек написал резюме в Word и упомянул Kubernetes
// в описании проекта — навык терялся. Теперь ищем по всему тексту.
//
// У каждого навыка есть каноническое имя и список написаний: «к8с»,
// «k8s» и «кубернетес» — один и тот же Kubernetes. В карточку попадает
// каноническое имя, поэтому фильтр по навыку работает предсказуемо.

export type Skill = {
  name: string;
  aliases?: string[];
  category: SkillCategory;
};

export type SkillCategory =
  | "languages"
  | "frontend"
  | "backend"
  | "data"
  | "infra"
  | "tools"
  | "office"
  | "soft";

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  languages: "Языки программирования",
  frontend: "Фронтенд",
  backend: "Бэкенд",
  data: "Базы и данные",
  infra: "Инфраструктура",
  tools: "Инструменты",
  office: "Офис и документы",
  soft: "Прочее",
};

export const SKILLS: Skill[] = [
  // Языки программирования
  { name: "JavaScript", aliases: ["js", "джаваскрипт"], category: "languages" },
  { name: "TypeScript", aliases: ["ts", "тайпскрипт"], category: "languages" },
  { name: "Python", aliases: ["питон", "пайтон"], category: "languages" },
  { name: "PHP", category: "languages" },
  { name: "Go", aliases: ["golang", "голанг"], category: "languages" },
  { name: "Java", aliases: ["джава"], category: "languages" },
  { name: "Kotlin", category: "languages" },
  { name: "Swift", category: "languages" },
  { name: "C#", aliases: ["c sharp", "си шарп"], category: "languages" },
  { name: "C++", aliases: ["cpp", "си плюс плюс"], category: "languages" },
  { name: "Ruby", category: "languages" },
  { name: "Rust", category: "languages" },
  { name: "Scala", category: "languages" },
  { name: "1С", aliases: ["1c", "1с-программирование"], category: "languages" },

  // Фронтенд
  {
    name: "React",
    aliases: ["реакт", "react.js", "reactjs"],
    category: "frontend",
  },
  { name: "Vue", aliases: ["vue.js", "vuejs", "вью"], category: "frontend" },
  { name: "Angular", aliases: ["ангуляр"], category: "frontend" },
  { name: "Next.js", aliases: ["nextjs", "некст"], category: "frontend" },
  { name: "Svelte", category: "frontend" },
  { name: "HTML", category: "frontend" },
  { name: "CSS", category: "frontend" },
  { name: "Sass", aliases: ["scss"], category: "frontend" },
  { name: "Tailwind", aliases: ["tailwindcss"], category: "frontend" },
  { name: "Redux", category: "frontend" },
  { name: "React Native", aliases: ["react-native"], category: "frontend" },
  { name: "Flutter", category: "frontend" },

  // Бэкенд
  { name: "Node.js", aliases: ["nodejs", "node", "нода"], category: "backend" },
  { name: "Django", aliases: ["джанго"], category: "backend" },
  { name: "FastAPI", category: "backend" },
  { name: "Flask", category: "backend" },
  { name: "Laravel", aliases: ["ларавел"], category: "backend" },
  { name: "Symfony", category: "backend" },
  { name: "Spring", aliases: ["spring boot"], category: "backend" },
  { name: "Express", aliases: ["express.js"], category: "backend" },
  { name: "NestJS", aliases: ["nest.js"], category: "backend" },
  { name: ".NET", aliases: ["dotnet", "asp.net"], category: "backend" },
  { name: "REST API", aliases: ["rest", "restful"], category: "backend" },
  { name: "GraphQL", category: "backend" },
  { name: "gRPC", category: "backend" },
  { name: "Микросервисы", aliases: ["microservices"], category: "backend" },

  // Базы и данные
  { name: "SQL", category: "data" },
  { name: "PostgreSQL", aliases: ["postgres", "постгрес"], category: "data" },
  { name: "MySQL", category: "data" },
  { name: "MongoDB", aliases: ["монго"], category: "data" },
  { name: "Redis", aliases: ["редис"], category: "data" },
  { name: "Elasticsearch", aliases: ["elastic"], category: "data" },
  { name: "ClickHouse", category: "data" },
  { name: "Oracle", category: "data" },
  { name: "MS SQL", aliases: ["mssql", "sql server"], category: "data" },
  { name: "Kafka", aliases: ["кафка"], category: "data" },
  { name: "RabbitMQ", aliases: ["кролик"], category: "data" },
  { name: "Power BI", aliases: ["powerbi"], category: "data" },
  { name: "Tableau", category: "data" },
  { name: "Google Analytics", aliases: ["ga4"], category: "data" },

  // Инфраструктура
  { name: "Docker", aliases: ["докер"], category: "infra" },
  {
    name: "Kubernetes",
    aliases: ["k8s", "к8с", "кубернетес", "кубер"],
    category: "infra",
  },
  { name: "Linux", aliases: ["линукс"], category: "infra" },
  { name: "Nginx", category: "infra" },
  { name: "AWS", category: "infra" },
  { name: "Azure", category: "infra" },
  { name: "Google Cloud", aliases: ["gcp"], category: "infra" },
  { name: "Terraform", category: "infra" },
  { name: "Ansible", category: "infra" },
  { name: "CI/CD", aliases: ["ci cd", "сicd"], category: "infra" },
  { name: "GitLab CI", aliases: ["gitlab-ci"], category: "infra" },
  { name: "Jenkins", category: "infra" },
  { name: "Prometheus", category: "infra" },
  { name: "Grafana", aliases: ["графана"], category: "infra" },

  // Инструменты
  { name: "Git", aliases: ["гит"], category: "tools" },
  { name: "Jira", aliases: ["джира"], category: "tools" },
  { name: "Confluence", category: "tools" },
  { name: "Postman", category: "tools" },
  { name: "Figma", aliases: ["фигма"], category: "tools" },
  { name: "Notion", category: "tools" },
  { name: "Trello", category: "tools" },
  { name: "Bitrix24", aliases: ["битрикс24", "битрикс"], category: "tools" },
  { name: "amoCRM", aliases: ["амосрм", "амо срм"], category: "tools" },
  { name: "Scrum", aliases: ["скрам"], category: "tools" },
  { name: "Agile", aliases: ["эджайл"], category: "tools" },
  { name: "Kanban", aliases: ["канбан"], category: "tools" },

  // Офис и документы
  { name: "Excel", aliases: ["эксель", "ms excel"], category: "office" },
  { name: "Word", aliases: ["ms word"], category: "office" },
  { name: "PowerPoint", aliases: ["пауэрпоинт"], category: "office" },
  { name: "Google Sheets", aliases: ["гугл таблицы"], category: "office" },
  { name: "1С:Бухгалтерия", aliases: ["1с бухгалтерия"], category: "office" },
  { name: "SAP", category: "office" },
];

// Символы, которые в названиях навыков значат сами себя, а в шаблоне
// поиска означают совсем другое: C++ иначе превратился бы в «C» и два
// «повторить предыдущее».
function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Граница слова \b с кириллицей в JavaScript не работает, поэтому
// проверяем вручную: слева и справа не должно быть буквы или цифры.
// Иначе «Go» находился бы внутри слова «Google», а «SQL» — в «MySQL».
const BEFORE = "(?<![\\p{L}\\p{N}])";
const AFTER = "(?![\\p{L}\\p{N}])";

const PATTERNS: { skill: Skill; pattern: RegExp }[] = SKILLS.map((skill) => {
  const written = [skill.name, ...(skill.aliases ?? [])]
    .map(escape)
    // Пробел в названии может оказаться дефисом или переносом строки.
    .map((value) => value.replace(/\s+/g, "[\\s-]+"))
    .join("|");

  return {
    skill,
    pattern: new RegExp(`${BEFORE}(?:${written})${AFTER}`, "iu"),
  };
});

// Навыки, найденные в тексте резюме. Порядок — как в словаре,
// чтобы у всех кандидатов список выглядел одинаково.
export function findSkills(text: string): string[] {
  if (!text) return [];

  return PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ skill }) => skill.name,
  );
}

export function skillCategory(name: string): SkillCategory | null {
  return SKILLS.find((skill) => skill.name === name)?.category ?? null;
}

// Совпадение навыков кандидата с требованиями вакансии.
// Считается тем же словарём: из текста требований достаём навыки
// и смотрим, сколько из них есть у человека.
export function matchSkills(
  candidateSkills: string[],
  jobText: string,
): { required: string[]; matched: string[]; percent: number } {
  const required = findSkills(jobText);

  if (required.length === 0) {
    return { required: [], matched: [], percent: 0 };
  }

  const owned = new Set(candidateSkills.map((skill) => skill.toLowerCase()));
  const matched = required.filter((skill) => owned.has(skill.toLowerCase()));

  return {
    required,
    matched,
    percent: Math.round((matched.length / required.length) * 100),
  };
}
