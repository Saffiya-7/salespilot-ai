import { AlertTriangle, CheckCircle2, Copy, Download, FileSpreadsheet, UploadCloud, XCircle } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { LIMITS } from '../../../shared/constants';
import type { Lead } from '../../../shared/types';
import { useRefresh } from '../../hooks/useData';
import { CSV_TEMPLATE, guessMapping, LEAD_FIELDS, parseCsvText, validateImport, type ColumnMapping, type ParsedCsv } from '../../lib/csv';
import { bulkInsertLeads } from '../../services/leads';
import { downloadText } from '../../utils/download';
import { cn, pluralize } from '../../utils/format';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Tabs } from '../ui/PageHeader';

type Step = 'upload' | 'map' | 'review' | 'done';

export function CsvImportModal({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: Lead[] }) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; errors: string[] } | null>(null);
  const [reviewTab, setReviewTab] = useState<'valid' | 'invalid' | 'duplicates'>('valid');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const refresh = useRefresh();

  const validation = useMemo(() => (csv && step !== 'upload' ? validateImport(csv.rows, mapping, existing) : null), [csv, mapping, existing, step]);

  function reset() {
    setStep('upload');
    setCsv(null);
    setMapping({});
    setFileName('');
    setResult(null);
    setProgress(0);
  }

  function close() {
    if (importing) return;
    reset();
    onClose();
  }

  async function readFile(file: File) {
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      toast.error('Please choose a .csv file. In Excel or Google Sheets use File → Download → CSV.');
      return;
    }
    if (file.size > LIMITS.csvMaxBytes) {
      toast.error('That file is larger than 5 MB.');
      return;
    }
    const text = await file.text();
    const parsed = parseCsvText(text);
    setFileName(file.name);
    setCsv(parsed);
    setMapping(guessMapping(parsed.headers));
    if (parsed.headers.length && parsed.rows.length) setStep('map');
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void readFile(f);
  }

  async function runImport() {
    if (!validation?.valid.length) return;
    setImporting(true);
    try {
      const r = await bulkInsertLeads(validation.valid.map((v) => v.data), setProgress);
      setResult(r);
      setStep('done');
      await refresh('leads', 'activities');
      if (r.inserted) toast.success(`Imported ${pluralize(r.inserted, 'lead')}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const headerOptions = csv?.headers.map((h) => ({ value: h, label: h })) ?? [];
  const missingRequired = LEAD_FIELDS.filter((f) => f.required && !mapping[f.key]);

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title="Import leads from CSV"
      description={fileName ? `${fileName} · ${pluralize(csv?.rows.length ?? 0, 'row')}` : 'Upload a spreadsheet exported as CSV.'}
      footer={
        step === 'map' ? (
          <>
            <Button variant="secondary" onClick={reset}>Choose another file</Button>
            <Button onClick={() => setStep('review')} disabled={missingRequired.length > 0}>Validate rows</Button>
          </>
        ) : step === 'review' ? (
          <>
            <Button variant="secondary" onClick={() => setStep('map')} disabled={importing}>Back to mapping</Button>
            <Button onClick={runImport} loading={importing} disabled={!validation?.valid.length}>
              {importing ? `Importing ${progress}/${validation?.valid.length}…` : `Import ${pluralize(validation?.valid.length ?? 0, 'valid lead')}`}
            </Button>
          </>
        ) : step === 'done' ? (
          <Button onClick={close}>Done</Button>
        ) : undefined
      }
    >
      <ol className="mb-6 flex items-center gap-2 text-xs font-medium">
        {(['upload', 'map', 'review', 'done'] as Step[]).map((s, i) => {
          const idx = ['upload', 'map', 'review', 'done'].indexOf(step);
          return (
            <li key={s} className="flex items-center gap-2">
              <span className={cn('grid size-6 place-items-center rounded-full', i <= idx ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500')}>{i + 1}</span>
              <span className={cn('hidden sm:inline', i <= idx ? 'text-ink-900' : 'text-ink-400')}>{['Upload', 'Map columns', 'Review', 'Import'][i]}</span>
              {i < 3 && <span className="h-px w-6 bg-ink-200 sm:w-10" />}
            </li>
          );
        })}
      </ol>

      {step === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition',
              dragging ? 'border-brand-400 bg-brand-50' : 'border-ink-200 bg-lavender-25 hover:border-brand-300',
            )}
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-card">
              <UploadCloud className="size-6" />
            </div>
            <p className="mt-4 font-semibold text-ink-900">Drop your CSV here, or click to browse</p>
            <p className="mt-1 text-sm text-ink-500">Up to {LIMITS.csvMaxRows.toLocaleString()} rows · 5 MB. Contact name and company are required.</p>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
                e.target.value = '';
              }}
            />
          </div>
          {csv && csv.errors.length > 0 && (
            <Alert tone="error" title="We couldn't read that file">
              <ul className="list-disc pl-4">{csv.errors.map((er) => <li key={er}>{er}</li>)}</ul>
            </Alert>
          )}
          <button onClick={() => downloadText('salespilot-leads-template.csv', CSV_TEMPLATE, 'text/csv;charset=utf-8')} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
            <Download className="size-4" /> Download a CSV template
          </button>
        </div>
      )}

      {step === 'map' && csv && (
        <div className="space-y-5">
          {csv.errors.length > 0 && (
            <Alert tone="warning" title="Some rows had formatting issues">
              <ul className="list-disc pl-4">{csv.errors.map((er) => <li key={er}>{er}</li>)}</ul>
            </Alert>
          )}
          <p className="text-sm text-ink-600">We matched columns automatically where we could. Check each field and pick the CSV column it should come from.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LEAD_FIELDS.map((f) => (
              <Select
                key={f.key}
                label={f.label}
                required={f.required}
                value={mapping[f.key] ?? ''}
                onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
                options={headerOptions}
                placeholder="— Don't import —"
                error={f.required && !mapping[f.key] ? 'Required' : undefined}
              />
            ))}
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <FileSpreadsheet className="size-4 text-brand-600" /> Preview (first 5 rows)
            </div>
            <div className="scrollbar-thin overflow-x-auto rounded-xl ring-1 ring-ink-100">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-lavender-50 text-ink-600">
                  <tr>
                    {csv.headers.map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {csv.rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {csv.headers.map((h) => (
                        <td key={h} className="max-w-[220px] truncate px-3 py-2 text-ink-700">{r[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 'review' && validation && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="size-4" /> Ready to import</div>
              <div className="mt-1 font-display text-2xl font-bold text-emerald-900">{validation.valid.length}</div>
            </div>
            <div className="rounded-xl bg-rose-50 p-4 ring-1 ring-rose-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-800"><XCircle className="size-4" /> Invalid rows</div>
              <div className="mt-1 font-display text-2xl font-bold text-rose-900">{validation.invalid.length}</div>
            </div>
            <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800"><Copy className="size-4" /> Duplicates skipped</div>
              <div className="mt-1 font-display text-2xl font-bold text-amber-900">{validation.duplicates.length}</div>
            </div>
          </div>
          <Tabs
            value={reviewTab}
            onChange={setReviewTab}
            options={[
              { value: 'valid', label: 'Valid', count: validation.valid.length },
              { value: 'invalid', label: 'Errors', count: validation.invalid.length },
              { value: 'duplicates', label: 'Duplicates', count: validation.duplicates.length },
            ]}
          />
          <div className="scrollbar-thin max-h-80 overflow-y-auto rounded-xl ring-1 ring-ink-100">
            {reviewTab === 'valid' && (
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-lavender-50 text-ink-600">
                  <tr>
                    <th className="px-3 py-2">Row</th><th className="px-3 py-2">Contact</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {validation.valid.slice(0, 200).map((v) => (
                    <tr key={v.rowNumber}>
                      <td className="px-3 py-2 text-ink-400">{v.rowNumber}</td>
                      <td className="px-3 py-2 font-medium text-ink-800">{v.data.contact_name}</td>
                      <td className="px-3 py-2 text-ink-700">{v.data.company}</td>
                      <td className="px-3 py-2 text-ink-600">{v.data.email ?? '—'}</td>
                      <td className="px-3 py-2 text-amber-700">{v.warnings.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {reviewTab !== 'valid' && (
              <ul className="divide-y divide-ink-100 bg-white">
                {(reviewTab === 'invalid' ? validation.invalid : validation.duplicates).map((issue) => (
                  <li key={issue.rowNumber} className="flex gap-3 px-4 py-2.5 text-sm">
                    <AlertTriangle className={cn('mt-0.5 size-4 shrink-0', reviewTab === 'invalid' ? 'text-rose-500' : 'text-amber-500')} />
                    <div>
                      <span className="font-medium text-ink-800">{issue.rowNumber ? `Row ${issue.rowNumber}` : 'Mapping'}</span>
                      <span className="text-ink-600"> — {issue.messages.join('; ')}</span>
                    </div>
                  </li>
                ))}
                {(reviewTab === 'invalid' ? validation.invalid : validation.duplicates).length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-500">Nothing here 🎉</li>}
              </ul>
            )}
          </div>
          {validation.valid.length > 200 && reviewTab === 'valid' && <p className="text-xs text-ink-500">Showing the first 200 valid rows.</p>}
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-4">
          <Alert tone={result.errors.length ? 'warning' : 'info'} title={`Imported ${pluralize(result.inserted, 'lead')}`}>
            {result.errors.length ? `${result.errors.length} row(s) could not be saved:` : 'All valid rows were saved. You can now research and score them with AI.'}
          </Alert>
          {result.errors.length > 0 && (
            <ul className="max-h-60 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-rose-700">
              {result.errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
