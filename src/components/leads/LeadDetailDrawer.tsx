import { useMutation } from '@tanstack/react-query';
import { CalendarClock, ExternalLink, Gauge, Mail, Pencil, Search, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { PIPELINE_STAGES, SCORE_FACTORS, type PipelineStage } from '../../../shared/constants';
import { followupUrgency } from '../../../shared/metrics';
import type { Lead } from '../../../shared/types';
import { useFollowups, useLeadActivities, useLeads, useLeadScores, useRefresh } from '../../hooks/useData';
import { addNote } from '../../services/activities';
import { changeStage, deleteLead } from '../../services/leads';
import { cn, formatDate, formatMoney, formatRelative, initials, websiteHref } from '../../utils/format';
import { Badge, ScoreBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AiLabel, EmptyState, Skeleton } from '../ui/Feedback';
import { Select, Textarea } from '../ui/Field';
import { ConfirmDialog, Drawer } from '../ui/Modal';
import { ActivityTimeline } from './ActivityTimeline';
import { LeadFormModal } from './LeadFormModal';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium text-ink-400">{label}</dt>
      <dd className="mt-0.5 truncate text-[13.5px] text-ink-800">{children || <span className="text-ink-300">—</span>}</dd>
    </div>
  );
}

function Section({ title, children, action }: { title: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function LeadDetailDrawer({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const { data: leads } = useLeads();
  const lead = leads?.find((l) => l.id === leadId) ?? null;
  return (
    <Drawer
      open={!!leadId}
      onClose={onClose}
      title={
        lead ? (
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-400 to-brand-700 text-sm font-bold text-white">{initials(lead.contact_name)}</span>
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink-950">{lead.contact_name}</div>
              <div className="truncate text-xs text-ink-500">
                {[lead.job_title, lead.company].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-sm text-ink-500">Lead</span>
        )
      }
    >
      {lead ? <LeadDetailBody lead={lead} onClose={onClose} /> : <div className="p-6 text-sm text-ink-500">This lead no longer exists.</div>}
    </Drawer>
  );
}

function LeadDetailBody({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteType, setNoteType] = useState<'note' | 'call' | 'meeting'>('note');
  const [note, setNote] = useState('');
  const { data: activities, isLoading: actLoading } = useLeadActivities(lead.id);
  const { data: scores } = useLeadScores(lead.id);
  const { data: followups } = useFollowups();
  const pending = (followups ?? []).filter((f) => f.lead_id === lead.id && f.status === 'pending');
  const latestScore = scores?.[0];

  const stage = useMutation({
    mutationFn: (s: PipelineStage) => changeStage(lead, s),
    onSuccess: async (_d, s) => {
      toast.success(`Moved to ${s}`);
      await refresh('leads', 'activities');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: () => deleteLead(lead.id),
    onSuccess: async () => {
      toast.success('Lead deleted');
      setConfirmDelete(false);
      onClose();
      await refresh('leads', 'activities', 'followups', 'emails', 'emailCount');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const addNoteM = useMutation({
    mutationFn: () => addNote(lead.id, noteType, note.trim()),
    onSuccess: async () => {
      setNote('');
      toast.success('Added to timeline');
      await refresh('activities');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const go = (path: string) => {
    onClose();
    navigate(`${path}?lead=${lead.id}`);
  };

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-48">
          <Select aria-label="Pipeline stage" value={lead.status} onChange={(e) => stage.mutate(e.target.value as PipelineStage)} options={PIPELINE_STAGES} disabled={stage.isPending} />
        </div>
        <ScoreBadge score={lead.score} label={lead.score_label} />
        <div className="flex-1" />
        <Button variant="secondary" size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" icon={<Trash2 className="size-3.5" />} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Research', icon: <Search className="size-4" />, path: '/app/research' },
          { label: lead.score === null ? 'Score lead' : 'Re-score', icon: <Gauge className="size-4" />, path: '/app/scoring' },
          { label: 'Write e-mail', icon: <Mail className="size-4" />, path: '/app/emails' },
          { label: 'Follow-up', icon: <CalendarClock className="size-4" />, path: '/app/followups' },
        ].map((a) => (
          <button key={a.label} onClick={() => go(a.path)} className="flex items-center justify-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-[13px] font-medium text-ink-700 shadow-sm transition hover:border-brand-200 hover:text-brand-700">
            <span className="text-brand-600">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>

      <Section title="Details">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Row label="E-mail">{lead.email && <a className="text-brand-700 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a>}</Row>
          <Row label="Phone">{lead.phone}</Row>
          <Row label="Website">
            {lead.website && (
              <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={websiteHref(lead.website) ?? '#'} target="_blank" rel="noreferrer noopener">
                {lead.website} <ExternalLink className="size-3" />
              </a>
            )}
          </Row>
          <Row label="Industry">{lead.industry}</Row>
          <Row label="Company size">{lead.company_size && `${lead.company_size} employees`}</Row>
          <Row label="Location">{lead.location}</Row>
          <Row label="Source">{lead.source}</Row>
          <Row label="Deal value">{lead.deal_value !== null ? formatMoney(lead.deal_value) : null}</Row>
          <Row label="Budget">{lead.budget}</Row>
          <Row label="Last contacted">{lead.last_contacted_at && formatDate(lead.last_contacted_at)}</Row>
          <Row label="Next follow-up">{lead.next_follow_up_at && formatDate(lead.next_follow_up_at)}</Row>
          <Row label="Added">{formatDate(lead.created_at)}</Row>
        </dl>
        {(lead.requirements || lead.notes) && (
          <div className="mt-4 space-y-3 border-t border-ink-100 pt-4">
            {lead.requirements && (
              <div>
                <div className="text-[11.5px] font-medium text-ink-400">Requirements</div>
                <p className="mt-0.5 text-[13.5px] whitespace-pre-line text-ink-700">{lead.requirements}</p>
              </div>
            )}
            {lead.notes && (
              <div>
                <div className="text-[11.5px] font-medium text-ink-400">Notes</div>
                <p className="mt-0.5 text-[13.5px] whitespace-pre-line text-ink-700">{lead.notes}</p>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title={<span className="flex items-center gap-2">AI lead score <AiLabel>AI estimate</AiLabel></span>}>
        {latestScore ? (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-ink-950">{latestScore.score}</span>
              <span className="text-sm text-ink-500">/ 100 · {latestScore.label}</span>
              <span className="ml-auto text-xs text-ink-400">{formatRelative(latestScore.created_at)}</span>
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-700">{latestScore.explanation}</p>
            <div className="mt-3 grid gap-1.5">
              {SCORE_FACTORS.map((f) => {
                const v = latestScore.factors?.[f.key]?.score ?? 0;
                return (
                  <div key={f.key} className="flex items-center gap-3 text-xs text-ink-500">
                    <span className="w-40 shrink-0">{f.label}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-linear-to-r from-brand-400 to-brand-600" style={{ width: `${v * 10}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums">{v}/10</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-[13px] text-brand-900">
              <strong>Next action:</strong> {latestScore.next_action}
            </div>
            <p className="mt-2 text-[11px] text-ink-400">AI estimate of fit and priority — not a probability of conversion.</p>
          </div>
        ) : (
          <EmptyState compact icon={<Gauge className="size-5" />} title="Not scored yet" description="Get an AI estimate of how promising this lead is." action={<Button size="sm" onClick={() => go('/app/scoring')}>Score this lead</Button>} />
        )}
      </Section>

      {lead.research && (
        <Section
          title={<span className="flex items-center gap-2">AI research <AiLabel /></span>}
          action={<Badge tone={lead.research.mode === 'live_search' ? 'green' : 'slate'}>{lead.research.mode === 'live_search' ? 'With live search' : 'Your input only'}</Badge>}
        >
          <p className="text-[13.5px] leading-relaxed text-ink-700">{lead.research.company_overview}</p>
          <div className="mt-3 rounded-lg bg-lavender-50 px-3 py-2 text-[13px] text-ink-700">
            <strong className="text-ink-900">Outreach angle:</strong> {lead.research.outreach_angle}
          </div>
          <button onClick={() => go('/app/research')} className="mt-3 text-xs font-semibold text-brand-700 hover:underline">
            View full research →
          </button>
        </Section>
      )}

      <Section title={`Pending follow-ups (${pending.length})`} action={<Button size="xs" variant="subtle" onClick={() => go('/app/followups')}>Schedule</Button>}>
        {pending.length ? (
          <ul className="space-y-2">
            {pending.map((f) => {
              const u = followupUrgency(f.due_at);
              return (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg bg-lavender-25 px-3 py-2 text-[13px] ring-1 ring-ink-100">
                  <span className="capitalize">{f.channel}{f.note ? ` · ${f.note}` : ''}</span>
                  <Badge tone={u === 'overdue' ? 'red' : u === 'today' ? 'amber' : 'blue'}>{u === 'overdue' ? 'Overdue' : u === 'today' ? 'Today' : formatDate(f.due_at)}</Badge>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-500">No follow-ups scheduled.</p>
        )}
      </Section>

      <Section title="Activity history">
        <form
          className="mb-5 rounded-xl bg-lavender-25 p-3 ring-1 ring-ink-100"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) addNoteM.mutate();
          }}
        >
          <div className="mb-2 flex gap-1">
            {(['note', 'call', 'meeting'] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setNoteType(t)}
                className={cn('rounded-md px-2.5 py-1 text-xs font-medium capitalize', noteType === t ? 'bg-white text-brand-700 shadow-sm ring-1 ring-ink-100' : 'text-ink-500 hover:text-ink-800')}
              >
                {t === 'note' ? 'Note' : `Log ${t}`}
              </button>
            ))}
          </div>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={noteType === 'note' ? 'Add a note…' : `What happened on the ${noteType}?`} maxLength={1000} />
          <div className="mt-2 flex justify-end">
            <Button size="sm" type="submit" loading={addNoteM.isPending} disabled={!note.trim()}>
              Add to timeline
            </Button>
          </div>
        </form>
        {actLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : activities?.length ? (
          <ActivityTimeline activities={activities} />
        ) : (
          <p className="text-[13px] text-ink-500">No activity yet.</p>
        )}
      </Section>

      <LeadFormModal open={editing} onClose={() => setEditing(false)} lead={lead} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => del.mutate()}
        loading={del.isPending}
        title="Delete this lead?"
        message={
          <>
            <strong>{lead.contact_name}</strong> ({lead.company}) will be permanently deleted together with its scores, follow-ups and activity history. Saved e-mails are kept but unlinked. This cannot be undone.
          </>
        }
      />
    </div>
  );
}
