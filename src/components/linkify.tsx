// Текст, в котором адреса становятся кликабельными.
//
// В комментарии к интервью обычно лежит ссылка на встречу. Раньше её
// приходилось выделять и копировать вручную — теперь это ссылка.
//
// Разметку не разбираем и HTML из текста не строим: текст остаётся
// текстом, ссылки собираются из кусочков как обычные элементы.
// Так в комментарий нельзя протащить ничего исполняемого.

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

// Проверять тем же шаблоном нельзя: у глобального шаблона есть память
// о прошлом поиске, и одинаковые строки он определяет то так, то этак.
const IS_URL = /^https?:\/\//;

export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);

  return (
    <>
      {parts.map((part, index) =>
        IS_URL.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            // Ссылка часто лежит внутри кликабельной карточки —
            // не даём нажатию уйти наверх и открыть что-то ещё.
            onClick={(event) => event.stopPropagation()}
            className="text-ink underline decoration-accent underline-offset-2 transition hover:decoration-2"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
