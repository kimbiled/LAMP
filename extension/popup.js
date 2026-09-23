// Окошко расширения: сколько собрано, выгрузить файл, очистить пачку.

const STORE_KEY = "lamp_collected";

const countEl = document.getElementById("count");
const hintEl = document.getElementById("hint");
const downloadEl = document.getElementById("download");
const clearEl = document.getElementById("clear");

// Слово «резюме» не склоняется, а вот «в пачке» хочется дополнить
// размером: по нему видно, не разрослась ли выгрузка до неприличия.
function sizeText(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

async function readAll() {
  const data = await chrome.storage.local.get(STORE_KEY);
  return data[STORE_KEY] || {};
}

async function refresh() {
  const all = await readAll();
  const items = Object.values(all);

  countEl.textContent = String(items.length);
  downloadEl.disabled = items.length === 0;

  const bytes = items.reduce((sum, item) => sum + (item.sizeBytes || 0), 0);

  hintEl.textContent =
    items.length === 0
      ? "пачка пуста"
      : `резюме в пачке · ${sizeText(bytes)}`;
}

downloadEl.addEventListener("click", async () => {
  const all = await readAll();
  const items = Object.values(all);
  if (items.length === 0) return;

  const payload = {
    version: 1,
    source: new URL(items[0].url).hostname,
    exportedAt: new Date().toISOString(),
    candidates: items,
  };

  const blob = new Blob([JSON.stringify(payload)], {
    type: "application/json",
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `lamp-резюме-${stamp}.json`;
  link.click();

  // Освобождаем память: файл уже отдан браузеру.
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
});

clearEl.addEventListener("click", async () => {
  const all = await readAll();
  const count = Object.keys(all).length;

  if (count > 0 && !confirm(`Удалить собранные резюме (${count})?`)) return;

  await chrome.storage.local.remove(STORE_KEY);
  refresh();
});

refresh();
