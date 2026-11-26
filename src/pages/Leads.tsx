import { ArrowUpDown, Download, FileUp, Plus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CsvImportModal } from '../components/leads/CsvImportModal';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer';
import { LeadFiltersBar } from '../components/leads/LeadFiltersBar';
import { LeadFormModal } from '../components/leads/LeadFormModal';
import { ScoreBadge, StageBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState, ErrorNotice, Skeleton } from '../components/ui/Feedback';
import { Select } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { useLeads } from '../hooks/useData';
import { leadsToCsv } from '../lib/csv';
import { dateStamp, downloadText } from '../utils/download';
import { formatDate, formatMoney, formatRelative, initials, pluralize } from '../utils/format';
import { EMPTY_FILTERS, filterLeads, sortLeads, uniqueIndustries, type LeadFilters, type SortKey } from '../utils/leadFilters';

const PAGE = 50;

export default function Leads() {
  const { data: leads, isLoading, error } = useLeads();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('created_desc');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(params.get('new') === '1');
  const [importing, setImporting] = useState(params.get('import') === '1');
  const openId = params.get('lead');

  useEffect(() => setPage(1), [filters, sort]);

  const industries = useMemo(() => uniqueIndustries(leads ?? []), [leads]);
  const visible = useMemo(() => sortLeads(filterLeads(leads ?? [], filters), sort), [leads, filters, sort]);
  const pageItems = visible.slice(0, page * PAGE);

  const openLead = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('lead', id);
    else next.delete('lead');
    next.delete('new');
    next.delete('import');
    setParams(next, { replace: true });
  };

  const exportCsv = () => downloadText(`sumo-leads-${dateStamp()}.csv`, leadsToCsv(visible), 'text/csv;charset=utf-8');

  return (
    <div>
      <PageHeader
        eyebrow="Leads"
        title="Lead Management"
        description="Every prospect in one place. Add leads manually or import a CSV, then research, score and contact them with AI."
        actions={
          <>
            <Button variant="secondary" icon={<FileUp className="size-4" />} onClick={() => setImporting(true)}>
              Import CSV
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv} disabled={!visible.length}>
              Export{visible.length !== (leads?.length ?? 0) ? ' filtered' : ''}
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
              Add lead
            </Button>
          </>
        }
      />

      {error && <ErrorNotice error={error} className="mb-4" />}

      {isLoading ? (
        <Card className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Card>
      ) : !leads?.length ? (
        <Card>
          <EmptyState
            icon={<Users className="size-6" />}
            title="Add your first leads"
            description="Start by adding a lead manually or importing a CSV exported from your CRM, spreadsheet or LinkedIn tool. Sumo will help you research, score and contact them."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Add a lead</Button>
                <Button variant="secondary" icon={<FileUp className="size-4" />} onClick={() => setImporting(true)}>Import CSV</Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <LeadFiltersBar filters={filters} onChange={setFilters} industries={industries} />
          <div className="flex items-center justify-between gap-3 text-sm text-ink-500">
            <span>
              Showing <strong className="text-ink-800">{visible.length.toLocaleString()}</strong> of {pluralize(leads.length, 'lead')}
            </span>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="size-4" />
              <Select
                aria-label="Sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                options={[
                  { value: 'created_desc', label: 'Newest first' },
                  { value: 'created_asc', label: 'Oldest first' },
                  { value: 'score_desc', label: 'Highest AI score' },
                  { value: 'value_desc', label: 'Highest deal value' },
                  { value: 'name_asc', label: 'Name A–Z' },
                  { value: 'company_asc', label: 'Company A–Z' },
                ]}
                className="h-9 py-1.5"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <Card>
              <EmptyState compact title="No leads match these filters" description="Try a different search or clear the filters." action={<Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>} />
            </Card>
          ) : (
            <>
              {/* Desktop table */}
              <Card className="hidden overflow-hidden md:block">
                <div className="scrollbar-thin overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-ink-100 bg-lavender-25 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                    <tr>
                      <th className="px-5 py-3">Lead</th>
                      <th className="hidden px-3 py-3 xl:table-cell">Industry</th>
                      <th className="px-3 py-3">Stage</th>
                      <th className="px-3 py-3">AI score</th>
                      <th className="hidden px-3 py-3 2xl:table-cell">Value</th>
                      <th className="hidden px-3 py-3 xl:table-cell">Next follow-up</th>
                      <th className="px-5 py-3 text-right">Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {pageItems.map((l) => (
                      <tr key={l.id} onClick={() => openLead(l.id)} className="cursor-pointer transition hover:bg-lavender-25">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">{initials(l.contact_name)}</span>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-ink-900">{l.contact_name}</div>
                              <div className="truncate text-xs text-ink-500">
                                {l.company}
                                {l.job_title ? ` · ${l.job_title}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden max-w-[160px] truncate px-3 py-3 text-ink-600 xl:table-cell">{l.industry ?? <span className="text-ink-300">—</span>}</td>
                        <td className="px-3 py-3"><StageBadge stage={l.status} /></td>
                        <td className="px-3 py-3"><ScoreBadge score={l.score} label={l.score_label} /></td>
                        <td className="hidden px-3 py-3 text-ink-700 tabular-nums 2xl:table-cell">{l.deal_value !== null ? formatMoney(l.deal_value) : <span className="text-ink-300">—</span>}</td>
                        <td className="hidden px-3 py-3 text-ink-600 xl:table-cell">{l.next_follow_up_at ? formatDate(l.next_follow_up_at) : <span className="text-ink-300">—</span>}</td>
                        <td className="px-5 py-3 text-right text-xs text-ink-500">{formatRelative(l.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </Card>

              {/* Mobile cards */}
              <div className="grid gap-3 md:hidden">
                {pageItems.map((l) => (
                  <button key={l.id} onClick={() => openLead(l.id)} className="card p-4 text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink-900">{l.contact_name}</div>
                        <div className="truncate text-xs text-ink-500">{l.company}{l.industry ? ` · ${l.industry}` : ''}</div>
                      </div>
                      <ScoreBadge score={l.score} label={l.score_label} compact />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <StageBadge stage={l.status} />
                      <span className="text-xs text-ink-400">{formatRelative(l.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>

              {pageItems.length < visible.length && (
                <div className="flex justify-center">
                  <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>
                    Show more ({(visible.length - pageItems.length).toLocaleString()} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <LeadFormModal open={adding} onClose={() => setAdding(false)} onSaved={(l) => openLead(l.id)} />
      <CsvImportModal open={importing} onClose={() => setImporting(false)} existing={leads ?? []} />
      <LeadDetailDrawer leadId={openId} onClose={() => openLead(null)} />
    </div>
  );
}
