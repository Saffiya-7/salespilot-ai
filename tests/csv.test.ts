import { describe, expect, it } from 'vitest';
import { dedupeKey, guessMapping, leadsToCsv, normalizeCompanySize, parseCsvText, safeCell, validateImport } from '../src/lib/csv';
import { makeLead } from './fixtures';

const CSV = `﻿Name,Company,Email,Industry,Employees,Source,Stage,Deal Value
Priya Sharma,Northwind Labs,priya@northwind.com,SaaS,120,LinkedIn,interested,"12,000"
Arjun Rao,Kite & Co,arjun@kite.co,Retail,8,Billboard,New Lead,
,Missing Name Inc,x@y.com,,,,,
No Email,Orbit Logistics,,Logistics,5000+,Referral,Won,abc
Dup Person,Northwind Labs,PRIYA@northwind.com,SaaS,,,,
Bad Mail,Some Co,not-an-email,,,,,
`;

describe('parseCsvText', () => {
  it('reads headers, strips BOM and trims values', () => {
    const r = parseCsvText(CSV);
    expect(r.headers[0]).toBe('Name');
    expect(r.headers).toContain('Deal Value');
    expect(r.rows).toHaveLength(6);
    expect(r.rows[0].Company).toBe('Northwind Labs');
  });

  it('reports missing header / empty files', () => {
    expect(parseCsvText('').errors.length).toBeGreaterThan(0);
    expect(parseCsvText('Name,Company\n').errors.join(' ')).toMatch(/no data rows/i);
  });

  it('flags duplicate column names', () => {
    expect(parseCsvText('Name,Name\na,b\n').errors.join(' ')).toMatch(/Duplicate column/);
  });
});

describe('guessMapping', () => {
  it('maps common header names to lead fields', () => {
    const m = guessMapping(['Full Name', 'Company Name', 'E-mail', 'Job Title', 'Employees', 'Lead Source', 'Stage']);
    expect(m).toMatchObject({
      contact_name: 'Full Name',
      company: 'Company Name',
      email: 'E-mail',
      job_title: 'Job Title',
      company_size: 'Employees',
      source: 'Lead Source',
      status: 'Stage',
    });
  });

  it('falls back to "First name" for contact name', () => {
    expect(guessMapping(['First Name', 'Organization']).contact_name).toBe('First Name');
  });
});

describe('normalizeCompanySize', () => {
  it.each([
    ['11-50', '11-50'],
    ['11 – 50', '11-50'],
    ['8', '1-10'],
    ['120', '51-200'],
    ['1,500', '1001-5000'],
    ['10000', '5000+'],
    ['5000+', '5000+'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeCompanySize(input)).toBe(expected);
  });
  it('returns undefined for text without numbers', () => {
    expect(normalizeCompanySize('large')).toBeUndefined();
    expect(normalizeCompanySize('')).toBeUndefined();
  });
});

describe('validateImport', () => {
  const parsed = parseCsvText(CSV);
  const mapping = guessMapping(parsed.headers);

  it('requires contact name and company to be mapped', () => {
    const r = validateImport(parsed.rows, { email: 'Email' }, []);
    expect(r.valid).toHaveLength(0);
    expect(r.invalid[0].messages[0]).toMatch(/Contact name, Company/);
  });

  it('validates rows, normalises values, and detects duplicates', () => {
    const r = validateImport(parsed.rows, mapping, []);
    const names = r.valid.map((v) => v.data.contact_name);
    expect(names).toEqual(['Priya Sharma', 'Arjun Rao']);

    const priya = r.valid[0].data;
    expect(priya.status).toBe('Interested'); // case-insensitive stage match
    expect(priya.source).toBe('LinkedIn');
    expect(priya.company_size).toBe('51-200');
    expect(priya.deal_value).toBe(12000);

    const arjun = r.valid[1];
    expect(arjun.data.source).toBe('CSV Import');
    expect(arjun.warnings.join(' ')).toMatch(/Unknown source "Billboard"/);

    // invalid rows: missing name (row 4), bad deal value (row 5), bad e-mail (row 7)
    expect(r.invalid.map((i) => i.rowNumber).sort()).toEqual([4, 5, 7]);
    expect(r.invalid.find((i) => i.rowNumber === 4)?.messages.join(' ')).toMatch(/Contact name is required/);
    expect(r.invalid.find((i) => i.rowNumber === 5)?.messages.join(' ')).toMatch(/Deal value/);
    expect(r.invalid.find((i) => i.rowNumber === 7)?.messages.join(' ')).toMatch(/valid e-mail/);

    // duplicate e-mail within the file (case-insensitive)
    expect(r.duplicates).toHaveLength(1);
    expect(r.duplicates[0].rowNumber).toBe(6);
    expect(r.duplicates[0].messages[0]).toMatch(/row 2/);
  });

  it('detects duplicates against existing leads', () => {
    const existing = [makeLead({ email: 'arjun@KITE.co', company: 'Kite & Co', contact_name: 'Arjun Rao' })];
    const r = validateImport(parsed.rows, mapping, existing);
    expect(r.valid.map((v) => v.data.contact_name)).toEqual(['Priya Sharma']);
    expect(r.duplicates.some((d) => /existing lead/.test(d.messages[0]))).toBe(true);
  });

  it('uses company + name for duplicates when there is no e-mail', () => {
    expect(dedupeKey({ email: '', company: ' Orbit ', contact_name: 'Ann' })).toBe(dedupeKey({ email: null, company: 'orbit', contact_name: 'ANN ' }));
    expect(dedupeKey({ email: 'A@B.com' })).toBe('e:a@b.com');
  });
});

describe('CSV export', () => {
  it('neutralises spreadsheet formulas', () => {
    expect(safeCell('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(safeCell('+1 555')).toBe(`'+1 555`);
    expect(safeCell('@cmd')).toBe(`'@cmd`);
    expect(safeCell('Normal')).toBe('Normal');
    expect(safeCell(null)).toBe('');
    expect(safeCell(42)).toBe('42');
  });

  it('exports leads with a header row and escaped values', () => {
    const csv = leadsToCsv([makeLead({ contact_name: 'A, B', company: '=evil()', score: 80, score_label: 'Hot' })]);
    const [header, row] = csv.split(/\r?\n/);
    expect(header).toMatch(/^Contact name,Company,Email/);
    expect(row).toContain('"A, B"');
    expect(row).toContain(`'=evil()`);
    expect(row).toContain('Hot');
  });
});
