// Варианты поискового запроса.
//
// Люди ищут как получится:
//   • забыли переключить раскладку — «тфкшьфт» вместо «nariman»,
//     «пцукац» вместо английского слова;
//   • пишут имя латиницей, а в карточке оно кириллицей, и наоборот:
//     «nariman» ↔ «Нариман», «Жанар» ↔ «Zhanar».
//
// Поэтому ищем не только по самому запросу, но и по его вариантам:
// в другой раскладке и в транслите. Всё по правилам, без внешних
// сервисов: одна и та же строка всегда даёт одни и те же варианты.

const RU_KEYS = "йцукенгшщзхъфывапролджэячсмитьбю.ё";
const EN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,./`";

const RU_TO_EN = new Map<string, string>();
const EN_TO_RU = new Map<string, string>();
for (let i = 0; i < RU_KEYS.length; i++) {
  RU_TO_EN.set(RU_KEYS[i], EN_KEYS[i]);
  EN_TO_RU.set(EN_KEYS[i], RU_KEYS[i]);
}

// Набрано не в той раскладке: каждую букву меняем на ту, что стоит
// на той же клавише. Регистр сохраняем.
export function swapLayout(text: string): string {
  let result = "";
  for (const char of text) {
    const lower = char.toLowerCase();
    const mapped = RU_TO_EN.get(lower) ?? EN_TO_RU.get(lower);
    if (!mapped) {
      result += char;
      continue;
    }
    result += char === lower ? mapped : mapped.toUpperCase();
  }
  return result;
}

// Кириллица → латиница, как пишут имена в паспортах и на hh.
// Казахские буквы приводим к ближайшим латинским.
const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};

export function cyrillicToLatin(text: string): string {
  let result = "";
  for (const char of text) {
    const lower = char.toLowerCase();
    const mapped = CYR_TO_LAT[lower];
    if (mapped === undefined) {
      result += char;
    } else if (char !== lower && mapped) {
      result += mapped[0].toUpperCase() + mapped.slice(1);
    } else {
      result += mapped;
    }
  }
  return result;
}

// Латиница → кириллица. Сначала сочетания из нескольких букв
// («shch», «zh», «kh», «ya»), потом одиночные.
const LAT_TO_CYR: [string, string][] = [
  ["shch", "щ"], ["sch", "щ"],
  ["zh", "ж"], ["kh", "х"], ["ts", "ц"], ["ch", "ч"], ["sh", "ш"],
  ["yu", "ю"], ["ya", "я"], ["yo", "ё"], ["ye", "е"],
  ["a", "а"], ["b", "б"], ["c", "к"], ["d", "д"], ["e", "е"], ["f", "ф"],
  ["g", "г"], ["h", "х"], ["i", "и"], ["j", "дж"], ["k", "к"], ["l", "л"],
  ["m", "м"], ["n", "н"], ["o", "о"], ["p", "п"], ["q", "к"], ["r", "р"],
  ["s", "с"], ["t", "т"], ["u", "у"], ["v", "в"], ["w", "в"], ["x", "кс"],
  ["y", "й"], ["z", "з"],
];

export function latinToCyrillic(text: string): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i).toLowerCase();
    const pair = LAT_TO_CYR.find(([latin]) => rest.startsWith(latin));
    if (!pair) {
      result += text[i];
      i += 1;
      continue;
    }
    const [latin, cyr] = pair;
    const upper = text[i] !== text[i].toLowerCase();
    result += upper ? cyr[0].toUpperCase() + cyr.slice(1) : cyr;
    i += latin.length;
  }
  return result;
}

const HAS_CYRILLIC = /[а-яёәғқңөұүһі]/i;
const HAS_LATIN = /[a-z]/i;

// Все варианты запроса без повторов, сам запрос — первым.
// Варианты короче трёх знаков не берём: «ф» в другой раскладке — «a»,
// и такой поиск нашёл бы всех подряд.
export function searchVariants(query: string): string[] {
  const base = query.trim();
  if (!base) return [];

  const variants = new Set<string>([base]);
  const add = (value: string) => {
    const clean = value.trim();
    if (clean.length >= 3) variants.add(clean);
  };

  // Не та раскладка.
  const swapped = swapLayout(base);
  add(swapped);

  // Транслит в обе стороны.
  if (HAS_LATIN.test(base) && !HAS_CYRILLIC.test(base)) {
    add(latinToCyrillic(base));
  }
  if (HAS_CYRILLIC.test(base)) {
    add(cyrillicToLatin(base));
    // Английское слово, набранное в русской раскладке, а в карточке
    // имя кириллицей: «тфкшьфт» → «nariman» → «нариман».
    if (HAS_LATIN.test(swapped) && !HAS_CYRILLIC.test(swapped)) {
      add(latinToCyrillic(swapped));
    }
  }

  return [...variants];
}

// Регистр для поиска навыков: в базе это список строк, и сравнивать
// его без учёта регистра база не умеет. Даём основные написания:
// «excel», «Excel», «EXCEL».
export function caseVariants(value: string): string[] {
  const lower = value.toLowerCase();
  const capital = lower.charAt(0).toUpperCase() + lower.slice(1);
  return [...new Set([value, lower, capital, value.toUpperCase()])];
}
