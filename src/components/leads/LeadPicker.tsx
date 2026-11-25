import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lead } from '../../../shared/types';
import { cn } from '../../utils/format';
import { ScoreBadge } from '../ui/Badge';

/** Searchable lead selector. */
export function LeadPicker({
  leads,
  value,
  onChange,
  label = 'Lead',
  placeholder = 'Select a lead…',
  allowClear = true,
}: {
  leads: Lead[];
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = leads.find((l) => l.id === value) ?? null;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? leads.filter((l) => [l.contact_name, l.company, l.email, l.industry].some((v) => v?.toLowerCase().includes(s)))
      : leads;
    return list.slice(0, 100);
  }, [leads, q]);

  return (
    <div ref={ref} className="relative">
      {label && <div className="label">{label}</div>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span className="min-w-0 truncate">
            <span className="font-medium text-ink-900">{selected.contact_name}</span>
            <span className="text-ink-500"> · {selected.company}</span>
          </span>
        ) : (
          <span className="text-ink-400">{placeholder}</span>
        )}
        <span className="flex items-center gap-1">
          {selected && allowClear && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && onChange(null)}
              className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronsUpDown className="size-4 text-ink-400" />
        </span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-ink-100 bg-white shadow-pop">
          <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2">
            <Search className="size-4 text-ink-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, industry…" className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400" />
          </div>
          <ul role="listbox" className="scrollbar-thin max-h-72 overflow-y-auto p-1">
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-500">No matching leads</li>}
            {filtered.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={l.id === value}
                  onClick={() => {
                    onChange(l.id);
                    setOpen(false);
                    setQ('');
                  }}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-lavender-50', l.id === value && 'bg-brand-50')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink-900">{l.contact_name}</span>
                    <span className="block truncate text-xs text-ink-500">
                      {l.company}
                      {l.industry ? ` · ${l.industry}` : ''}
                    </span>
                  </span>
                  <ScoreBadge score={l.score} label={l.score_label} compact />
                  {l.id === value && <Check className="size-4 text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
