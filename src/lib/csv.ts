// CSV import/export for leads: parsing, column mapping, validation,
// duplicate detection and safe export.
import Papa from 'papaparse';
import { COMPANY_SIZES, LEAD_SOURCES, LIMITS, PIPELINE_STAGES, type CompanySize } from '../../shared/constants';
import { formatZodError, leadInputSchema, type LeadParsed } from '../../shared/schemas';
import type { Lead } from '../../shared/types';

export const LEAD_FIELDS = [
  { key: 'contact_name', label: 'Contact name', required: true, synonyms: ['name', 'full name', 'contact', 'contact name', 'person', 'lead name', 'prospect', 'prospect name'] },
  { key: 'company', label: 'Company', required: true, synonyms: ['company', 'company name', 'organisation', 'organization', 'account', 'business', 'org'] },
  { key: 'email', label: 'E-mail', required: false, synonyms: ['email', 'e-mail', 'email address', 'mail', 'work email'] },
  { key: 'phone', label: 'Phone', required: false, synonyms: ['phone', 'phone number', 'mobile', 'telephone', 'tel', 'contact number'] },
  { key: 'job_title', label: 'Job title', required: false, synonyms: ['title', 'job title', 'role', 'position', 'designation'] },
  { key: 'website', label: 'Website', required: false, synonyms: ['website', 'url', 'web', 'domain', 'site', 'company website'] },
  { key: 'industry', label: 'Industry', required: false, synonyms: ['industry', 'sector', 'vertical', 'segment'] },
  { key: 'company_size', label: 'Company size', required: false, synonyms: ['company size', 'size', 'employees', 'employee count', 'headcount', 'team size'] },
  { key: 'location', label: 'Location', required: false, synonyms: ['location', 'city', 'country', 'region', 'address'] },
  { key: 'source', label: 'Lead source', required: false, synonyms: ['source', 'lead source', 'channel', 'origin'] },
  { key: 'status', label: 'Stage / status', required: false, synonyms: ['status', 'stage', 'pipeline stage', 'lead status'] },
  { key: 'budget', label: 'Budget', required: false, synonyms: ['budget', 'budget range', 'spend'] },
  { key: 'requirements', label: 'Requirements', required: false, synonyms: ['requirements', 'needs', 'requirement', 'pain points', 'interest'] },
  { key: 'notes', label: 'Notes', required: false, synonyms: ['notes', 'note', 'comments', 'comment', 'description'] },
  { key: 'deal_value', label: 'Deal value', required: false, synonyms: ['deal value', 'value', 'amount', 'deal size', 'opportunity value'] },
] as const;

export type LeadFieldKey = (typeof LEAD_FIELDS)[number]['key'];
export type ColumnMapping = Partial<Record<LeadFieldKey, string>>;

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();

export function parseCsvText(text: string): ParsedCsv {
  const errors: string[] = [];
  if (text.length > LIMITS.csvMaxBytes) {
    return { headers: [], rows: [], errors: [`File is too large (max ${LIMITS.csvMaxBytes / 1024 / 1024} MB).`] };
  }
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  const headers = (result.meta.fields ?? []).filter((h) => h !== '');
  if (headers.length === 0) errors.push('No header row found. The first line of the file must contain column names.');
  // Papa Parse renames repeated headers ("Name", "Name_1"); tell the user.
  const renamed = (result.meta as { renamedHeaders?: Record<string, string> | null }).renamedHeaders;
  const dupHeaders = renamed ? [...new Set(Object.values(renamed))] : headers.filter((h, i) => headers.indexOf(h) !== i);
  if (dupHeaders.length) errors.push(`Duplicate column names: ${dupHeaders.join(', ')} (later copies were renamed)`);
  for (const e of result.errors.slice(0, 5)) {
    // "TooFewFields"/"TooManyFields" rows are still usable; report them as warnings.
    errors.push(`Row ${(e.row ?? 0) + 2}: ${e.message}`);
  }
  let rows = result.data.map((r) => {
    const clean: Record<string, string> = {};
    for (const h of headers) clean[h] = (r[h] ?? '').toString().trim();
    return clean;
  });
  if (rows.length > LIMITS.csvMaxRows) {
    errors.push(`Only the first ${LIMITS.csvMaxRows} rows will be imported.`);
    rows = rows.slice(0, LIMITS.csvMaxRows);
  }
  if (headers.length > 0 && rows.length === 0) errors.push('The file has a header row but no data rows.');
  return { headers, rows, errors };
}

/** Guess which CSV column feeds each lead field from common header names. */
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  const normalized = headers.map((h) => ({ h, n: norm(h) }));
  for (const field of LEAD_FIELDS) {
    const synonyms = (field.synonyms as readonly string[]).map(norm);
    const exact = normalized.find(({ h, n }) => !used.has(h) && synonyms.includes(n));
    if (exact) {
      mapping[field.key] = exact.h;
      used.add(exact.h);
    }
  }
  // second pass: "first name" + "last name" can't map 1:1, but "first name" alone is better than nothing
  if (!mapping.contact_name) {
    const first = normalized.find(({ h, n }) => !used.has(h) && (n === 'first name' || n === 'firstname'));
    if (first) mapping.contact_name = first.h;
  }
  return mapping;
}

export function normalizeCompanySize(raw: string): CompanySize | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  const compact = v.replace(/\s+/g, '').replace(/–|—/g, '-');
  const direct = COMPANY_SIZES.find((s) => s === compact);
  if (direct) return direct;
  const nums = compact.match(/\d[\d,]*/g)?.map((n) => Number(n.replace(/,/g, '')));
  if (!nums || nums.length === 0) return undefined;
  const n = Math.max(...nums);
  if (n <= 10) return '1-10';
  if (n <= 50) return '11-50';
  if (n <= 200) return '51-200';
  if (n <= 500) return '201-500';
  if (n <= 1000) return '501-1000';
  if (n <= 5000) return '1001-5000';
  return '5000+';
}

function matchEnum<T extends string>(values: readonly T[], raw: string): T | undefined {
  const n = norm(raw);
  return values.find((v) => norm(v) === n);
}

export interface RowIssue {
  rowNumber: number; // 1-based data row number as seen in a spreadsheet (header = row 1)
  messages: string[];
}

export interface ValidatedImport {
  valid: { rowNumber: number; data: LeadParsed; warnings: string[] }[];
  invalid: RowIssue[];
  duplicates: RowIssue[];
}

export function dedupeKey(lead: { email?: string | null; company?: string | null; contact_name?: string | null }): string {
  const email = (lead.email ?? '').trim().toLowerCase();
  if (email) return `e:${email}`;
  return `n:${(lead.company ?? '').trim().toLowerCase()}|${(lead.contact_name ?? '').trim().toLowerCase()}`;
}

/**
 * Map, validate and de-duplicate CSV rows.
 * Duplicates are detected against existing leads and against earlier rows in
 * the same file, by e-mail (case-insensitive) or, when there is no e-mail, by
 * company + contact name.
 */
export function validateImport(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  existing: Pick<Lead, 'email' | 'company' | 'contact_name'>[],
): ValidatedImport {
  const out: ValidatedImport = { valid: [], invalid: [], duplicates: [] };
  const missingRequired = LEAD_FIELDS.filter((f) => f.required && !mapping[f.key]);
  if (missingRequired.length) {
    out.invalid.push({
      rowNumber: 0,
      messages: [`Map a column for: ${missingRequired.map((f) => f.label).join(', ')}`],
    });
    return out;
  }
  const seen = new Map<string, string>();
  for (const l of existing) seen.set(dedupeKey(l), 'an existing lead');

  rows.forEach((row, i) => {
    const rowNumber = i + 2;
    const warnings: string[] = [];
    const get = (k: LeadFieldKey) => (mapping[k] ? (row[mapping[k] as string] ?? '').trim() : '');

    const rawSource = get('source');
    const source = rawSource ? matchEnum(LEAD_SOURCES, rawSource) : undefined;
    if (rawSource && !source) warnings.push(`Unknown source "${rawSource}" – saved as "CSV Import"`);
    const rawStatus = get('status');
    const status = rawStatus ? matchEnum(PIPELINE_STAGES, rawStatus) : undefined;
    if (rawStatus && !status) warnings.push(`Unknown stage "${rawStatus}" – saved as "New Lead"`);
    const rawSize = get('company_size');
    const size = normalizeCompanySize(rawSize);
    if (rawSize && !size) warnings.push(`Could not read company size "${rawSize}"`);

    const candidate = {
      contact_name: get('contact_name'),
      company: get('company'),
      email: get('email'),
      phone: get('phone'),
      job_title: get('job_title'),
      website: get('website'),
      industry: get('industry'),
      company_size: size,
      location: get('location'),
      source: source ?? 'CSV Import',
      status: status ?? 'New Lead',
      budget: get('budget'),
      requirements: get('requirements'),
      notes: get('notes'),
      deal_value: get('deal_value'),
    };

    const parsed = leadInputSchema.safeParse(candidate);
    if (!parsed.success) {
      out.invalid.push({ rowNumber, messages: formatZodError(parsed.error).split('; ') });
      return;
    }
    const key = dedupeKey(parsed.data);
    const prior = seen.get(key);
    if (prior) {
      const what = parsed.data.email ? `e-mail ${parsed.data.email}` : `${parsed.data.contact_name} at ${parsed.data.company}`;
      out.duplicates.push({ rowNumber, messages: [`Duplicate of ${prior} (${what})`] });
      return;
    }
    seen.set(key, `row ${rowNumber}`);
    out.valid.push({ rowNumber, data: parsed.data, warnings });
  });
  return out;
}

/** Prevent spreadsheet formula injection when a cell starts with = + - @ (or tab/CR). */
export function safeCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export const EXPORT_COLUMNS: { key: keyof Lead; header: string }[] = [
  { key: 'contact_name', header: 'Contact name' },
  { key: 'company', header: 'Company' },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Phone' },
  { key: 'job_title', header: 'Job title' },
  { key: 'website', header: 'Website' },
  { key: 'industry', header: 'Industry' },
  { key: 'company_size', header: 'Company size' },
  { key: 'location', header: 'Location' },
  { key: 'source', header: 'Source' },
  { key: 'status', header: 'Stage' },
  { key: 'score', header: 'AI score (estimate)' },
  { key: 'score_label', header: 'AI priority' },
  { key: 'budget', header: 'Budget' },
  { key: 'deal_value', header: 'Deal value' },
  { key: 'requirements', header: 'Requirements' },
  { key: 'notes', header: 'Notes' },
  { key: 'last_contacted_at', header: 'Last contacted' },
  { key: 'next_follow_up_at', header: 'Next follow-up' },
  { key: 'created_at', header: 'Created' },
];

export function leadsToCsv(leads: Lead[]): string {
  return Papa.unparse({
    fields: EXPORT_COLUMNS.map((c) => c.header),
    data: leads.map((l) => EXPORT_COLUMNS.map((c) => safeCell(l[c.key] as unknown))),
  });
}

export function rowsToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return Papa.unparse({ fields: headers, data: rows.map((r) => r.map(safeCell)) });
}

export const CSV_TEMPLATE = Papa.unparse({
  fields: ['Name', 'Company', 'Email', 'Job title', 'Website', 'Industry', 'Company size', 'Source', 'Budget', 'Requirements', 'Deal value'],
  data: [],
});
