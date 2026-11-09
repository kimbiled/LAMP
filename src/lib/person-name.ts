// Как достать из ФИО имя для обращения и как показать ФИО без отчества.
//
// Порядок слов бывает разный: hh пишет «Оспанов Данияр Серикович»,
// латиницей часто «Zhanar Mussina», сами люди — «Иван Петров».
// Поэтому смотрим не на место слова, а на окончание: фамилии и
// отчества узнаются по окончаниям, имя — то, что осталось.
//
// \b и \w с кириллицей не работают, поэтому только явные окончания
// и сравнение в нижнем регистре.

// Отчество: Серикович, Сериковна, Ильинична, Серікұлы, Серікқызы, Serikuly.
const PATRONYMIC = /(вич|вна|ична|ұлы|улы|қызы|кызы|ovich|evich|ovna|evna|uly|kyzy|qyzy)$/;

// Окончания, которые почти всегда у фамилии.
const STRONG_SURNAME =
  /(ов|ова|ев|ева|ёв|ёва|ский|ская|цкий|цкая|енко|ov|ova|ev|eva|sky|skiy|skii|skaya|enko)$/;

// Окончания, которые бывают и у фамилии (Мусина, Ильин), и у имени (Марина).
const WEAK_SURNAME = /(ин|ина|ын|ына|in|ina|yn|yna)$/;

// Частые имена на -ина / -ин, чтобы не принять их за фамилию.
const NAMES_LIKE_SURNAMES = new Set([
  "марина", "ирина", "алина", "карина", "галина", "полина", "кристина",
  "валентина", "екатерина", "ангелина", "регина", "нина", "дина", "мадина",
  "амина", "аина", "айна", "лина", "элина", "эльвина", "арина", "дарина",
  "зарина", "сабина", "альбина", "мартин", "дин",
  "marina", "irina", "alina", "karina", "galina", "polina", "kristina",
  "valentina", "ekaterina", "angelina", "regina", "nina", "dina", "madina",
  "amina", "aina", "lina", "elina", "arina", "darina", "zarina", "sabina",
  "albina", "martin", "dean",
]);

const CYRILLIC = /[а-яёәіңғүұқөһ]/i;

function words(fullName: string): string[] {
  return fullName.trim().split(/\s+/).filter(Boolean);
}

function isPatronymic(word: string): boolean {
  const w = word.toLowerCase();
  return w.length >= 6 && PATRONYMIC.test(w);
}

// 2 — точно фамилия, 1 — похоже на фамилию, 0 — похоже на имя.
function surnameScore(word: string): number {
  const w = word.toLowerCase();
  if (w.length < 4 || NAMES_LIKE_SURNAMES.has(w)) return 0;
  if (STRONG_SURNAME.test(w)) return 2;
  if (WEAK_SURNAME.test(w)) return 1;
  return 0;
}

// «ДАНИЯР» → «Данияр»: в резюме имя иногда набрано заглавными.
function tidy(word: string): string {
  if (word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase()) {
    return word[0] + word.slice(1).toLowerCase();
  }
  return word;
}

// Имя для обращения: «Здравствуйте, Данияр!».
export function firstNameOf(fullName: string): string {
  const all = words(fullName);
  if (all.length === 0) return "";
  if (all.length === 1) return tidy(all[0]);

  const rest = all.filter((word) => !isPatronymic(word));
  const parts = rest.length > 0 ? rest : all;
  if (parts.length === 1) return tidy(parts[0]);

  const [a, b] = parts;
  const scoreA = surnameScore(a);
  const scoreB = surnameScore(b);
  if (scoreA > scoreB) return tidy(b);
  if (scoreB > scoreA) return tidy(a);

  // Не различить. Отчество в ФИО значит русский порядок «Фамилия Имя
  // Отчество». Иначе по письму: кириллицей чаще «Фамилия Имя» (так
  // выгружает hh), латиницей — «Name Surname».
  if (rest.length < all.length) return tidy(b);
  return tidy(CYRILLIC.test(a) ? b : a);
}

