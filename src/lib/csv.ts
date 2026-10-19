/** One CSV cell: quoted when needed, and guarded so spreadsheet apps never run it as a formula. */
function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Builds a CSV file and downloads it (opens in Excel / Google Sheets / Numbers). */
export function downloadCsv(fileName: string, headers: string[], rows: unknown[][]) {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  // BOM so Excel reads ₦ and Hausa letters correctly.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
