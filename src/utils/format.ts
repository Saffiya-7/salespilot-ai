import { clsx, type ClassValue } from 'clsx';

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, opts);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;

export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 864e5],
    ['month', 30 * 864e5],
    ['week', 7 * 864e5],
    ['day', 864e5],
    ['hour', 36e5],
    ['minute', 6e4],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'minute') {
      const value = Math.round(diff / ms);
      if (unit === 'minute' && Math.abs(value) < 1) return 'just now';
      return rtf ? rtf.format(value, unit) : d.toLocaleDateString();
    }
  }
  return d.toLocaleDateString();
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

/** Compact money without assuming a currency symbol (the app is currency-neutral). */
export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { notation: n >= 100000 ? 'compact' : 'standard', maximumFractionDigits: n >= 100000 ? 1 : 0 }).format(n);
}

export function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/** yyyy-mm-dd for <input type="date"> in local time. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function websiteHref(w: string | null | undefined): string | null {
  if (!w) return null;
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}

export function pluralize(n: number, word: string, plural = `${word}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? word : plural}`;
}
