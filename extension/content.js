// Сборщик резюме с hh.
//
// Работает на страницах hh.kz и hh.ru, пока вы там залогинены под своим
// аккаунтом работодателя. Собранное копится в памяти расширения, а потом
// выгружается одним файлом — его вы загружаете в Skillo.
//
// Главный принцип: НЕ вычитывать поля из вёрстки hh. Вёрстка меняется,
// и такой сборщик ломался бы каждые пару месяцев. Вместо этого берём
// тот же PDF, который hh отдаёт по своей кнопке «Скачать», — его Skillo
// разбирает сам, и делает это лучше, чем любое чтение разметки.
//
// Из разметки берём только подсказки (имя, должность) — чтобы в списке
// перед импортом было видно, кого собрали. Если их не окажется,
// ничего не сломается: имя всё равно придёт из PDF.

(() => {
  "use strict";

  // Сколько резюме забираем за один заход со списка.
  // Ограничение намеренное: пачка в сотни штук — это уже не работа
  // рекрутера, а выкачивание базы, и hh на такое реагирует.
  const MAX_PER_RUN = 30;

  // Пауза между резюме. Тоже намеренная: без неё запросы идут очередью
  // в десяток в секунду, что ни на какое живое пользование не похоже.
  const PAUSE_MS = [1500, 3000];

  const STORE_KEY = "lamp_collected";

  let busy = false;

  // ---------- хранилище ----------

  async function readAll() {
    const data = await chrome.storage.local.get(STORE_KEY);
    return data[STORE_KEY] || {};
  }

  async function saveOne(entry) {
    const all = await readAll();
    // Ключ — ссылка на резюме: повторный сбор того же человека
    // просто обновит запись, а не добавит вторую.
    all[entry.url] = entry;
    await chrome.storage.local.set({ [STORE_KEY]: all });
    return Object.keys(all).length;
  }

  // ---------- мелкие помощники ----------

  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

  function pause() {
    const [min, max] = PAUSE_MS;
    return sleep(min + Math.random() * (max - min));
  }

  // btoa не принимает большие массивы целиком — упирается в предел
  // аргументов функции. Поэтому режем на куски.
  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;

    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }

    return btoa(binary);
  }

  function resumeHash(href) {
    const match = String(href).match(/\/resume\/([0-9a-zA-Z]{8,})/);
    return match ? match[1] : null;
  }

  function resumeUrl(hash) {
    return `${location.origin}/resume/${hash}`;
  }

  // ---------- сообщения на экране ----------

  let toastEl = null;

  function toast(text, kind) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "lamp-toast";
      document.body.appendChild(toastEl);
    }

    toastEl.textContent = text;
    toastEl.dataset.kind = kind || "info";
    toastEl.classList.add("lamp-toast--visible");

    clearTimeout(toast.timer);
    if (kind !== "progress") {
      toast.timer = setTimeout(() => {
        toastEl.classList.remove("lamp-toast--visible");
      }, 4000);
    }
  }

  // ---------- разбор страницы резюме ----------

  // Подсказки из разметки. Всё необязательное: если hh переименует
  // свои атрибуты, здесь просто будет null, и это нормально.
  function readHints(doc) {
    const text = (selector) => {
      const node = doc.querySelector(selector);
      const value = node && node.textContent ? node.textContent.trim() : "";
      return value || null;
    };

    return {
      fullName: text('[data-qa="resume-personal-name"]'),
      position: text('[data-qa="resume-block-title-position"]'),
      city: text('[data-qa="resume-personal-address"]'),
      age: text('[data-qa="resume-personal-age"]'),
      salary: text('[data-qa="resume-block-salary"]'),
    };
  }

  // Ссылка на PDF — та самая, что стоит под кнопкой «Скачать».
  // Ищем её в самой странице, а не собираем из кусочков: собранный
  // вручную адрес перестанет работать при первой же смене формата.
  function findPdfHref(doc, html) {
    const links = Array.from(doc.querySelectorAll("a[href]"))
      .map((a) => a.getAttribute("href"))
      .filter((href) => href && href.includes("resume_converter"));

    // Пункты меню «Скачать» hh дорисовывает только после нажатия, и в
    // разметке их может не быть. Зато адрес лежит в данных страницы —
    // ищем его в самом тексте HTML.
    if (html) {
      const raw = html.match(/\/resume_converter\/[^"'\s<>]+/g) || [];
      for (const found of raw) {
        links.push(
          found
            .replace(/\\u002F/gi, "/")
            .replace(/\\u0026/gi, "&")
            .replace(/&amp;/g, "&"),
        );
      }
    }

    if (links.length === 0) return null;

    const pdf = links.find(
      (href) => href.includes("type=pdf") || href.includes(".pdf"),
    );

    return new URL(pdf || links[0], location.origin).href;
  }

  // Последний запасной путь: адрес, по которому hh отдаёт PDF.
  // Собирать его вручную хрупко, поэтому пробуем, только если ссылки
  // не нашлось ни в разметке, ни в данных страницы.
  function fallbackPdfHref(hash) {
    return `${location.origin}/resume_converter/resume.pdf?hash=${hash}&type=pdf`;
  }

  // Настоящий PDF начинается с «%PDF». Если hh вместо файла вернул
  // страницу входа или капчу, сохранять её как резюме нельзя.
  function isPdf(buffer) {
    const head = new Uint8Array(buffer.slice(0, 5));
    return String.fromCharCode(...head) === "%PDF-";
  }

  function fileNameFrom(hints, hash) {
    const base = (hints.fullName || `resume-${hash}`)
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return `${base}.pdf`;
  }

  // ---------- сбор одного резюме ----------

  // doc — уже открытая страница, если мы на ней стоим. Для списка
  // страницу приходится дочитывать запросом.
  async function collectResume(hash, doc) {
    const url = resumeUrl(hash);
    let html = null;

    if (!doc) {
      const page = await fetch(url, { credentials: "include" });
      if (!page.ok) throw new Error(`страница резюме: ${page.status}`);
      html = await page.text();
      doc = new DOMParser().parseFromString(html, "text/html");
    } else {
      html = doc.documentElement ? doc.documentElement.innerHTML : null;
    }

    const hints = readHints(doc);
    let pdfHref = findPdfHref(doc, html);

    // На открытой странице меню «Скачать» могло быть ещё не нарисовано —
    // перечитываем её с сервера: там адрес есть в данных страницы.
    if (!pdfHref && !html?.includes("resume_converter")) {
      const page = await fetch(url, { credentials: "include" });
      if (page.ok) {
        const fresh = await page.text();
        pdfHref = findPdfHref(
          new DOMParser().parseFromString(fresh, "text/html"),
          fresh,
        );
      }
    }

    const file = await fetch(pdfHref || fallbackPdfHref(hash), {
      credentials: "include",
    });
    if (!file.ok) {
      throw new Error(
        pdfHref
          ? `скачивание PDF: ${file.status}`
          : "на странице нет ссылки на скачивание PDF",
      );
    }

    const buffer = await file.arrayBuffer();
    if (buffer.byteLength < 1000) {
      throw new Error("PDF пустой — возможно, контакты ещё не открыты");
    }
    if (!isPdf(buffer)) {
      throw new Error(
        "вместо PDF пришла страница — проверьте, что вы вошли в hh как работодатель",
      );
    }

    return saveOne({
      url,
      fileName: fileNameFrom(hints, hash),
      mimeType: "application/pdf",
      fileBase64: toBase64(buffer),
      sizeBytes: buffer.byteLength,
      hints,
      collectedAt: new Date().toISOString(),
    });
  }

  // ---------- что собирать на этой странице ----------

  function hashesOnPage() {
    const found = new Set();

    for (const link of document.querySelectorAll('a[href*="/resume/"]')) {
      const hash = resumeHash(link.getAttribute("href"));
      if (hash) found.add(hash);
    }

    return Array.from(found);
  }

  async function run() {
    if (busy) return;
    busy = true;

    try {
      const here = resumeHash(location.pathname);

      if (here) {
        const total = await collectResume(here, document);
        toast(`Собрано. Всего в пачке: ${total}`, "ok");
        return;
      }

      const hashes = hashesOnPage().slice(0, MAX_PER_RUN);

      if (hashes.length === 0) {
        toast("На этой странице резюме не найдено", "warn");
        return;
      }

      let done = 0;
      let failed = 0;
      let total = 0;

      for (const hash of hashes) {
        toast(`Собираю ${done + failed + 1} из ${hashes.length}…`, "progress");

        try {
          total = await collectResume(hash, null);
          done += 1;
        } catch (error) {
          failed += 1;
          console.warn("[Skillo] не удалось собрать", hash, error);
        }

        // Пауза не нужна после последнего.
        if (done + failed < hashes.length) await pause();
      }

      toast(
        failed > 0
          ? `Собрано ${done}, не вышло ${failed}. Всего в пачке: ${total}`
          : `Собрано ${done}. Всего в пачке: ${total}`,
        failed > 0 ? "warn" : "ok",
      );
    } catch (error) {
      console.error("[Skillo]", error);
      toast(`Не получилось: ${error.message}`, "error");
    } finally {
      busy = false;
    }
  }

  // ---------- кнопка и горячая клавиша ----------

  function mountButton() {
    if (document.getElementById("lamp-collect-button")) return;

    const button = document.createElement("button");
    button.id = "lamp-collect-button";
    button.className = "lamp-button";
    button.type = "button";
    button.textContent = "Собрать в Skillo";
    button.addEventListener("click", run);

    document.body.appendChild(button);
  }

  // Ctrl+Shift+B в Chrome занят показом панели закладок, и отобрать его
  // «правильным» способом (через настройки расширения) нельзя. Поэтому
  // ловим нажатие прямо на странице и гасим его: пока курсор на hh,
  // сочетание работает на сбор. Если Chrome всё-таки моргнёт панелью
  // закладок — рядом есть кнопка и запасное сочетание Ctrl+Shift+Y.
  function onKeyDown(event) {
    if (!event.ctrlKey || !event.shiftKey || event.altKey) return;

    // Смотрим на код клавиши, а не на букву: на русской раскладке
    // та же клавиша даёт «и», и проверка по букве бы не сработала.
    if (event.code !== "KeyB" && event.code !== "KeyY") return;

    event.preventDefault();
    event.stopPropagation();
    run();
  }

  window.addEventListener("keydown", onKeyDown, true);

  mountButton();

  // hh — одностраничное приложение: при переходе между резюме страница
  // не перезагружается, и кнопка может пропасть вместе с разметкой.
  // Поэтому раз в секунду проверяем, на месте ли она.
  setInterval(mountButton, 1000);
})();
