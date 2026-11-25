export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  // BOM so Excel opens UTF-8 CSVs correctly
  const content = mime.startsWith('text/csv') ? `﻿${text}` : text;
  downloadBlob(filename, new Blob([content], { type: mime }));
}

export function dateStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
