// Подбор кандидатов из базы по описанию вакансии.
//
// Рекрутер вставляет название и требования («Аналитик данных, SQL,
// Power BI, опыт от 3 лет») — система берёт из текста значимые слова
// и ищет людей, у которых они встречаются в должности, навыках,
// опыте или тексте резюме. Чем больше совпало слов, тем выше человек
// в списке. Всё правилами, без нейросетей.

// Слова, которые есть в любом описании и ничего не говорят о человеке.
const STOP_WORDS = new Set([
  "опыт", "опыта", "работы", "работа", "работе", "знание", "знания", "умение",
  "навыки", "навык", "требования", "обязанности", "условия", "компания",
  "компании", "вакансия", "вакансии", "кандидат", "кандидата", "лет", "года",
  "год", "годы", "более", "менее", "также", "который", "которые", "наличие",
  "желательно", "обязательно", "хорошее", "хорошие", "высшее", "образование",
  "уровень", "уровня", "сотрудник", "специалист", "специалиста", "ведущий",
  "старший", "младший", "главный", "отдел", "отдела", "работать", "команде",
  "команда", "график", "зарплата", "оклад", "полный", "день", "офис", "office",
  "with", "and", "the", "for", "experience", "years", "knowledge", "skills",
  "senior", "junior", "middle", "lead", "work",
]);

const WORD = /[a-zа-яёәғқңөұүһі0-9+#.]+/giu;

// Обрезаем русское слово до основы: «аналитика», «аналитиком» →
// «аналити»; так находятся все формы. Английские и короткие — целиком.
function stem(word: string): string {
  if (!/[а-яё]/i.test(word) || word.length <= 5) return word;
  return word.slice(0, Math.max(5, word.length - 2));
}

// Ключевые слова из описания: без повторов, без служебных слов,
// не больше `limit` — первые слова описания (обычно название) важнее.
export function jobKeywords(text: string, limit = 10): string[] {
  const words = (text.toLowerCase().match(WORD) ?? [])
    .map((word) => word.replace(/^[.]+|[.]+$/g, ""))
    .filter((word) => word.length >= 3 || /^[a-z0-9+#]{2}$/i.test(word))
    .filter((word) => !STOP_WORDS.has(word))
    .filter((word) => !/^\d+$/.test(word));

  const result: string[] = [];
  for (const word of words) {
    const key = stem(word);
    if (!result.includes(key)) result.push(key);
    if (result.length >= limit) break;
  }
  return result;
}

// Сводим совпадения по словам в рейтинг: id → сколько слов совпало.
export function rankMatches(hits: string[][]): { id: string; score: number }[] {
  const score = new Map<string, number>();
  for (const ids of hits) {
    for (const id of new Set(ids)) score.set(id, (score.get(id) ?? 0) + 1);
  }
  return [...score.entries()]
    .map(([id, value]) => ({ id, score: value }))
    .sort((a, b) => b.score - a.score);
}
