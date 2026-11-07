// Таблица для Excel.
//
// Русский Excel ждёт точку с запятой между столбцами, а кодировку
// узнаёт по невидимой метке в начале файла (BOM). Без неё вместо
// кириллицы получаются «кракозябры».

export type CsvCell = string | number | null | undefined;

// Значение, начинающееся с = + - @, Excel выполняет как формулу.
// Кандидат может вписать такое в резюме, поэтому экранируем апострофом.
function protect(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(value) : protect(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((row) => row.map(cell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
