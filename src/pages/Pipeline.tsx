import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GripVertical, KanbanSquare, Plus } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { PIPELINE_STAGES, type PipelineStage } from '../../shared/constants';
import type { Lead } from '../../shared/types';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer';
import { LeadFiltersBar } from '../components/leads/LeadFiltersBar';
import { LeadFormModal } from '../components/leads/LeadFormModal';
import { ScoreBadge, STAGE_DOT } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState, ErrorNotice, Skeleton } from '../components/ui/Feedback';
import { PageHeader } from '../components/ui/PageHeader';
import { qk, useLeads, useRefresh } from '../hooks/useData';
import { changeStage } from '../services/leads';
import { cn, formatMoney, formatRelative } from '../utils/format';
import { EMPTY_FILTERS, filterLeads, uniqueIndustries, type LeadFilters } from '../utils/leadFilters';

export default function Pipeline() {
  const { data: leads, isLoading, error } = useLeads();
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_FILTERS);
  const [params, setParams] = useSearchParams();
  const [dragOver, setDragOver] = useState<PipelineStage | null>(null);
  const [addStage, setAddStage] = useState<PipelineStage | null>(null);
  const qc = useQueryClient();
  const refresh = useRefresh();
  const openId = params.get('lead');

  const industries = useMemo(() => uniqueIndustries(leads ?? []), [leads]);
  const visible = useMemo(() => filterLeads(leads ?? [], { ...filters, stage: '' }), [leads, filters]);
  const columns = useMemo(
    () =>
      PIPELINE_STAGES.map((stage) => {
        const items = visible.filter((l) => l.status === stage).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.updated_at.localeCompare(a.updated_at));
        return { stage, items, value: items.reduce((s, l) => s + Number(l.deal_value ?? 0), 0) };
      }),
    [visible],
  );

  const move = useMutation({
    mutationFn: ({ lead, stage }: { lead: Lead; stage: PipelineStage }) => changeStage(lead, stage),
    onMutate: async ({ lead, stage }) => {
      await qc.cancelQueries({ queryKey: qk.leads });
      const prev = qc.getQueryData<Lead[]>(qk.leads);
      qc.setQueryData<Lead[]>(qk.leads, (old) => old?.map((l) => (l.id === lead.id ? { ...l, status: stage } : l)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.leads, ctx.prev);
      toast.error((e as Error).message);
    },
    onSuccess: (_d, { lead, stage }) => toast.success(`${lead.contact_name} → ${stage}`),
    onSettled: () => refresh('leads', 'activities'),
  });

  function onDrop(e: DragEvent, stage: PipelineStage) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/lead-id');
    const lead = leads?.find((l) => l.id === id);
    if (lead && lead.status !== stage) move.mutate({ lead, stage });
  }

  const openLead = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('lead', id);
    else next.delete('lead');
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline"
        title="Sales Pipeline"
        description="Drag cards between stages to update a deal. Changes are saved instantly and recorded in each lead's activity history."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setAddStage('New Lead')}>Add lead</Button>}
      />
      {error && <ErrorNotice error={error} className="mb-4" />}

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0" />
          ))}
        </div>
      ) : !leads?.length ? (
        <Card>
          <EmptyState
            icon={<KanbanSquare className="size-6" />}
            title="Your pipeline is empty"
            description="Add leads to see them flow from New Lead to Won. You can also import a CSV from the Lead Management page."
            action={<Button icon={<Plus className="size-4" />} onClick={() => setAddStage('New Lead')}>Add your first lead</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="mb-4">
            <LeadFiltersBar filters={filters} onChange={setFilters} industries={industries} showStage={false} />
          </div>
          <div className="scrollbar-thin -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            {columns.map((col) => (
              <section
                key={col.stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col.stage);
                }}
                onDragLeave={() => setDragOver((s) => (s === col.stage ? null : s))}
                onDrop={(e) => onDrop(e, col.stage)}
                className={cn(
                  'flex w-[280px] shrink-0 snap-start flex-col rounded-2xl bg-lavender-100/70 ring-1 ring-ink-100 transition',
                  dragOver === col.stage && 'bg-brand-50 ring-2 ring-brand-300',
                )}
                aria-label={`${col.stage} column`}
              >
                <header className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('size-2 rounded-full', STAGE_DOT[col.stage])} />
                    <h2 className="text-[13px] font-semibold text-ink-900">{col.stage}</h2>
                    <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold text-ink-500 tabular-nums ring-1 ring-ink-100">{col.items.length}</span>
                  </div>
                  <button onClick={() => setAddStage(col.stage)} className="rounded-md p-1 text-ink-400 hover:bg-white hover:text-brand-600" aria-label={`Add lead to ${col.stage}`}>
                    <Plus className="size-4" />
                  </button>
                </header>
                <div className="px-3.5 pb-2 text-[11px] text-ink-500">{col.value > 0 ? `Value ${formatMoney(col.value)}` : ' '}</div>
                <div className="scrollbar-thin flex max-h-[calc(100vh-330px)] min-h-32 flex-col gap-2 overflow-y-auto px-2.5 pb-3">
                  {col.items.map((l) => (
                    <article
                      key={l.id}
                      draggable
                      onDragStart={(e) => {
                        const de = e;
                        de.dataTransfer.setData('text/lead-id', l.id);
                        de.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => openLead(l.id)}
                      className="group cursor-pointer rounded-xl bg-white p-3 shadow-card ring-1 ring-ink-100 transition hover:ring-brand-200 active:cursor-grabbing"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 size-4 shrink-0 text-ink-300 opacity-0 transition group-hover:opacity-100" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-semibold text-ink-900">{l.company}</div>
                          <div className="truncate text-xs text-ink-500">{l.contact_name}{l.job_title ? ` · ${l.job_title}` : ''}</div>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <ScoreBadge score={l.score} label={l.score_label} compact />
                        <span className="text-[11px] text-ink-400">{l.deal_value !== null ? formatMoney(l.deal_value) : formatRelative(l.status_changed_at)}</span>
                      </div>
                      {/* Keyboard / touch friendly stage switch */}
                      <select
                        aria-label={`Move ${l.company} to stage`}
                        value={l.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => move.mutate({ lead: l, stage: e.target.value as PipelineStage })}
                        className="mt-2 w-full rounded-lg border border-ink-100 bg-lavender-25 px-2 py-1 text-[11.5px] text-ink-600 lg:hidden"
                      >
                        {PIPELINE_STAGES.map((s) => (
                          <option key={s} value={s}>Move to: {s}</option>
                        ))}
                      </select>
                    </article>
                  ))}
                  {col.items.length === 0 && <div className="grid h-20 place-items-center rounded-xl border border-dashed border-ink-200 text-xs text-ink-400">Drop leads here</div>}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      <LeadFormModal open={!!addStage} onClose={() => setAddStage(null)} defaultStage={addStage ?? undefined} />
      <LeadDetailDrawer leadId={openId} onClose={() => openLead(null)} />
    </div>
  );
}
