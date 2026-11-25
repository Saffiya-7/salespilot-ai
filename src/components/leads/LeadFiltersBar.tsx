import { Search, X } from 'lucide-react';
import { LEAD_SOURCES, PIPELINE_STAGES } from '../../../shared/constants';
import { EMPTY_FILTERS, type LeadFilters } from '../../utils/leadFilters';
import { Select } from '../ui/Field';

export function LeadFiltersBar({
  filters,
  onChange,
  industries,
  showStage = true,
  showSource = true,
}: {
  filters: LeadFilters;
  onChange: (f: LeadFilters) => void;
  industries: string[];
  showStage?: boolean;
  showSource?: boolean;
}) {
  const set = (k: keyof LeadFilters) => (e: { target: { value: string } }) => onChange({ ...filters, [k]: e.target.value });
  const active = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  return (
    <div className="flex flex-col gap-2.5 2xl:flex-row 2xl:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" />
        <input value={filters.q} onChange={set('q')} placeholder="Search by name, company, e-mail, industry…" className="input pl-10" aria-label="Search leads" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 2xl:flex">
        {showStage && <Select aria-label="Stage" value={filters.stage} onChange={set('stage')} options={PIPELINE_STAGES} placeholder="All stages" wrapperClassName="2xl:w-40" />}
        <Select aria-label="Industry" value={filters.industry} onChange={set('industry')} options={industries} placeholder="All industries" wrapperClassName="2xl:w-44" />
        <Select
          aria-label="AI score"
          value={filters.score}
          onChange={set('score')}
          options={[
            { value: 'Hot', label: 'Hot (75+)' },
            { value: 'Warm', label: 'Warm (45–74)' },
            { value: 'Cold', label: 'Cold (<45)' },
            { value: 'unscored', label: 'Not scored' },
          ]}
          placeholder="All scores"
          wrapperClassName="2xl:w-36"
        />
        {showSource && <Select aria-label="Source" value={filters.source} onChange={set('source')} options={LEAD_SOURCES} placeholder="All sources" wrapperClassName="2xl:w-36" />}
        {active && (
          <button onClick={() => onChange(EMPTY_FILTERS)} className="col-span-2 flex items-center justify-center gap-1 rounded-xl px-3 py-2 md:col-span-4 2xl:col-span-1 text-sm font-medium text-ink-500 hover:bg-white hover:text-ink-800">
            <X className="size-4" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
