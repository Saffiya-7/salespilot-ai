import { useMutation } from '@tanstack/react-query';
import {
  AlarmClock,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  Mail,
  MoreHorizontal,
  Phone,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { EMAIL_TONES, FOLLOWUP_CHANNELS, PIPELINE_STAGES, type EmailTone, type FollowupChannel, type PipelineStage } from '../../shared/constants';
import { followupStats, followupUrgency } from '../../shared/metrics';
import type { Followup, FollowupDraft, Lead } from '../../shared/types';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer';
import { LeadPicker } from '../components/leads/LeadPicker';
import { Badge, StageBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AiLabel, AiThinking, Alert, EmptyState, ErrorNotice, Skeleton } from '../components/ui/Feedback';
import { Input, Select, Textarea } from '../components/ui/Field';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { PageHeader, StatCard, Tabs } from '../components/ui/PageHeader';
import { useFollowups, useLeads, useRefresh } from '../hooks/useData';
import { generateFollowup } from '../services/ai';
import { completeFollowup, createFollowup, deleteFollowup, updateFollowup } from '../services/followups';
import { changeStage } from '../services/leads';
import { addDays, cn, formatPercent, formatRelative, toDateInput } from '../utils/format';

const CHANNEL_ICON: Record<FollowupChannel, ReactNode> = {
  email: <Mail className="size-3.5" />,
  call: <Phone className="size-3.5" />,
  linkedin: <Users className="size-3.5" />,
  meeting: <CalendarCheck className="size-3.5" />,
  other: <MoreHorizontal className="size-3.5" />,
};

function dueIso(dateStr: string): string {
  return new Date(`${dateStr}T09:00:00`).toISOString();
}

function ScheduleModal({ open, onClose, leads, presetLead, presetDate, presetMessage, presetChannel }: {
  open: boolean;
  onClose: () => void;
  leads: Lead[];
  presetLead?: string | null;
  presetDate?: string;
  presetMessage?: string;
  presetChannel?: FollowupChannel;
}) {
  const refresh = useRefresh();
  const [leadId, setLeadId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [channel, setChannel] = useState<FollowupChannel>('email');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) {
      setLeadId(presetLead ?? null);
      setDate(presetDate ?? toDateInput(addDays(new Date(), 3).toISOString()));
      setChannel(presetChannel ?? 'email');
      setNote('');
    }
  }, [open, presetLead, presetDate, presetChannel]);
  const lead = leads.find((l) => l.id === leadId);
  const m = useMutation({
    mutationFn: () => createFollowup({ lead: lead!, due_at: dueIso(date), channel, note, message: presetMessage }),
    onSuccess: async () => {
      toast.success('Follow-up scheduled');
      await refresh('followups', 'leads', 'activities');
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule a follow-up"
      description="SalesPilot reminds you — you stay in control of every message."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!lead || !date}>Schedule</Button>
        </>
      }
    >
      <div className="space-y-4">
        <LeadPicker leads={leads} value={leadId} onChange={setLeadId} allowClear={false} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Due date" type="date" required value={date} min={toDateInput(new Date().toISOString())} onChange={(e) => setDate(e.target.value)} />
          <Select label="Channel" value={channel} onChange={(e) => setChannel(e.target.value as FollowupChannel)} options={FOLLOWUP_CHANNELS.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))} />
        </div>
        <Textarea label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Share the case study they asked about" maxLength={2000} />
        {presetMessage && <Alert tone="ai">The AI-drafted message will be attached to this follow-up.</Alert>}
      </div>
    </Modal>
  );
}

function ComposerModal({ open, onClose, lead, followup, onSchedule }: {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  followup: Followup | null;
  onSchedule: (draft: FollowupDraft & { body: string; subject: string }) => void;
}) {
  const refresh = useRefresh();
  const [tone, setTone] = useState<EmailTone>('Professional');
  const [context, setContext] = useState('');
  const [draft, setDraft] = useState<FollowupDraft | null>(null);
  useEffect(() => {
    if (open) {
      setDraft(null);
      setContext('');
    }
  }, [open, lead?.id]);
  const gen = useMutation({
    mutationFn: () => generateFollowup({ lead_id: lead!.id, followup_id: followup?.id, tone, context: context || undefined }),
    onSuccess: async (r) => {
      setDraft(r.draft);
      await refresh('emails', 'emailCount', 'activities', 'followups');
    },
  });
  const copy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`).then(() => toast.success('Copied'), () => toast.error('Could not copy'));
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={<span className="flex items-center gap-2">AI follow-up <AiLabel /></span>} description={lead ? `${lead.contact_name} · ${lead.company} · ${lead.status}` : undefined}>
      {!lead ? null : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Select label="Tone" value={tone} onChange={(e) => setTone(e.target.value as EmailTone)} options={EMAIL_TONES} />
            <Input label="Anything new to mention? (optional)" value={context} onChange={(e) => setContext(e.target.value)} placeholder="e.g. they asked for pricing last week" maxLength={1000} />
          </div>
          <Button icon={<Sparkles className="size-4" />} loading={gen.isPending} onClick={() => gen.mutate()}>
            {draft ? 'Regenerate' : 'Draft follow-up from history'}
          </Button>
          {gen.isPending && <AiThinking label="Reading this lead's history and drafting…" />}
          {gen.error && <ErrorNotice error={gen.error} />}
          {draft && !gen.isPending && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-900">
                <AlarmClock className="size-4 text-brand-600" />
                <strong>Recommended:</strong> {draft.channel} in {draft.recommended_days_from_now} day{draft.recommended_days_from_now === 1 ? '' : 's'}
                <span className="basis-full text-brand-800/80 sm:basis-auto">— {draft.timing_reason}</span>
              </div>
              <Input label="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              <Textarea label="Message" rows={9} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
              {draft.talking_points.length > 0 && (
                <div>
                  <div className="label">Talking points</div>
                  <ul className="space-y-1">{draft.talking_points.map((t, i) => <li key={i} className="flex gap-2 text-[13px] text-ink-700"><Check className="mt-0.5 size-3.5 text-emerald-500" />{t}</li>)}</ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={copy}>Copy</Button>
                <a
                  href={`mailto:${lead.email ? encodeURIComponent(lead.email) : ''}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body.slice(0, 1800))}`}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-ink-950 px-3 text-[13px] font-medium text-white hover:bg-ink-800"
                >
                  <ExternalLink className="size-3.5" /> Open in mail app
                </a>
                {followup ? (
                  <Button size="sm" variant="subtle" onClick={async () => { await updateFollowup(followup.id, { message: draft.body }); await refresh('followups'); toast.success('Message attached to the follow-up'); }}>
                    Attach to this follow-up
                  </Button>
                ) : (
                  <Button size="sm" variant="subtle" icon={<CalendarPlus className="size-3.5" />} onClick={() => onSchedule(draft)}>
                    Schedule for recommended date
                  </Button>
                )}
              </div>
              <p className="text-[11.5px] text-ink-400">Nothing is sent automatically. Review the message and send it from your own mail app.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function CompleteModal({ followup, lead, onClose }: { followup: Followup | null; lead: Lead | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [outcome, setOutcome] = useState('');
  const [stage, setStage] = useState<string>('');
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState(toDateInput(addDays(new Date(), 7).toISOString()));
  useEffect(() => {
    setOutcome('');
    setStage('');
    setScheduleNext(false);
  }, [followup?.id]);
  const m = useMutation({
    mutationFn: async () => {
      if (!followup || !lead) return;
      await completeFollowup(followup, lead, outcome);
      if (stage && stage !== lead.status) await changeStage({ ...lead, status: lead.status === 'New Lead' ? 'Contacted' : lead.status }, stage as PipelineStage);
      if (scheduleNext) await createFollowup({ lead, due_at: dueIso(nextDate), channel: followup.channel });
    },
    onSuccess: async () => {
      toast.success('Follow-up completed');
      await refresh('followups', 'leads', 'activities');
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal
      open={!!followup}
      onClose={onClose}
      title="Mark follow-up as done"
      description={lead ? `${lead.contact_name} · ${lead.company}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button icon={<Check className="size-4" />} onClick={() => m.mutate()} loading={m.isPending}>Complete</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea label="Outcome (optional)" rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Left voicemail · Asked for a proposal" maxLength={500} />
        <Select label="Update lead stage (optional)" value={stage} onChange={(e) => setStage(e.target.value)} options={PIPELINE_STAGES} placeholder={`Keep as ${lead?.status ?? ''}`} />
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" className="size-4 accent-brand-600" checked={scheduleNext} onChange={(e) => setScheduleNext(e.target.checked)} />
          Schedule the next follow-up
        </label>
        {scheduleNext && <Input type="date" label="Next follow-up date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />}
      </div>
    </Modal>
  );
}

export default function Followups() {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: followups = [], isLoading, error } = useFollowups();
  const [params, setParams] = useSearchParams();
  const refresh = useRefresh();
  const [tab, setTab] = useState<'due' | 'upcoming' | 'history'>('due');
  const [schedule, setSchedule] = useState<{ lead?: string | null; date?: string; message?: string; channel?: FollowupChannel } | null>(params.get('lead') ? { lead: params.get('lead') } : null);
  const [composer, setComposer] = useState<{ lead: Lead; followup: Followup | null } | null>(null);
  const [completing, setCompleting] = useState<Followup | null>(null);
  const [toDelete, setToDelete] = useState<Followup | null>(null);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const stats = useMemo(() => followupStats(followups), [followups]);

  useEffect(() => {
    if (params.get('lead')) {
      const next = new URLSearchParams(params);
      next.delete('lead');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const lists = useMemo(() => {
    const pending = followups.filter((f) => f.status === 'pending');
    return {
      due: pending.filter((f) => followupUrgency(f.due_at) !== 'upcoming'),
      upcoming: pending.filter((f) => followupUrgency(f.due_at) === 'upcoming'),
      history: followups.filter((f) => f.status !== 'pending').sort((a, b) => (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at)),
    };
  }, [followups]);

  const needsAttention = useMemo(() => {
    const withPending = new Set(followups.filter((f) => f.status === 'pending').map((f) => f.lead_id));
    const weekAgo = Date.now() - 7 * 86_400_000;
    return leads
      .filter((l) => l.status !== 'Won' && l.status !== 'Lost' && !withPending.has(l.id))
      .filter((l) => (l.last_contacted_at ? new Date(l.last_contacted_at).getTime() < weekAgo : l.status !== 'New Lead'))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 8);
  }, [leads, followups]);

  const skip = useMutation({
    mutationFn: (f: Followup) => updateFollowup(f.id, { status: 'skipped' }, f.lead_id),
    onSuccess: async () => {
      toast.success('Follow-up skipped');
      await refresh('followups', 'leads');
    },
  });
  const reschedule = useMutation({
    mutationFn: ({ f, date }: { f: Followup; date: string }) => updateFollowup(f.id, { due_at: dueIso(date) }, f.lead_id),
    onSuccess: async () => {
      toast.success('Rescheduled');
      await refresh('followups', 'leads');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (f: Followup) => deleteFollowup(f.id, f.lead_id),
    onSuccess: async () => {
      setToDelete(null);
      toast.success('Follow-up deleted');
      await refresh('followups', 'leads');
    },
  });

  const current = lists[tab];

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline"
        title="Follow-up Automation"
        description="Track every next step, catch overdue follow-ups, and let AI draft context-aware messages and suggest timing. You review and send — nothing goes out automatically."
        actions={<Button icon={<CalendarPlus className="size-4" />} onClick={() => setSchedule({})} disabled={!leads.length}>Schedule follow-up</Button>}
      />
      {error && <ErrorNotice error={error} className="mb-4" />}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Overdue" value={stats.overdue} icon={<AlarmClock className="size-4" />} accent="red" hint="Due before today" />
        <StatCard label="Due today" value={stats.dueToday} icon={<CalendarClock className="size-4" />} accent="amber" />
        <StatCard label="Upcoming" value={stats.upcoming} icon={<CalendarPlus className="size-4" />} accent="blue" />
        <StatCard label="Completion rate" value={formatPercent(stats.completionRate)} icon={<CalendarCheck className="size-4" />} accent="green" hint={`${stats.completed} completed · ${stats.skipped} skipped`} />
      </div>

      {!leadsLoading && leads.length === 0 ? (
        <Card><EmptyState icon={<CalendarClock className="size-6" />} title="Add leads to start tracking follow-ups" description="Follow-ups are always linked to a lead in your pipeline." /></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
              <Tabs
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'due', label: 'Due & overdue', count: lists.due.length },
                  { value: 'upcoming', label: 'Upcoming', count: lists.upcoming.length },
                  { value: 'history', label: 'History', count: lists.history.length },
                ]}
              />
            </div>
            <CardBody className="pt-3">
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : current.length === 0 ? (
                <EmptyState compact icon={<CalendarCheck className="size-5" />} title={tab === 'due' ? 'Nothing due — nice work!' : tab === 'upcoming' ? 'No upcoming follow-ups' : 'No completed follow-ups yet'} description={tab !== 'history' ? 'Schedule follow-ups for leads you are working.' : undefined} />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {current.map((f) => {
                    const lead = leadById.get(f.lead_id);
                    const u = followupUrgency(f.due_at);
                    return (
                      <li key={f.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                        <button onClick={() => setOpenLead(f.lead_id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                          <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', f.status !== 'pending' ? 'bg-emerald-50 text-emerald-600' : u === 'overdue' ? 'bg-rose-50 text-rose-600' : u === 'today' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700')}>
                            {CHANNEL_ICON[f.channel]}
                          </span>
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-[13.5px] font-semibold text-ink-900">{lead?.contact_name ?? 'Deleted lead'}</span>
                              {lead && <StageBadge stage={lead.status} />}
                            </span>
                            <span className="block truncate text-xs text-ink-500">
                              {lead?.company} · <span className="capitalize">{f.channel}</span>
                              {f.note ? ` · ${f.note}` : ''}
                            </span>
                            {f.message && <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700"><Sparkles className="size-3" /> AI message attached</span>}
                          </span>
                        </button>
                        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                          {f.status === 'pending' ? (
                            <>
                              <Badge tone={u === 'overdue' ? 'red' : u === 'today' ? 'amber' : 'blue'}>
                                {u === 'overdue' ? 'Overdue' : u === 'today' ? 'Today' : 'Upcoming'}
                              </Badge>
                              <input
                                type="date"
                                aria-label="Reschedule"
                                title="Reschedule"
                                className="h-7 w-[118px] cursor-pointer rounded-lg border border-ink-200 bg-white px-1.5 text-[11.5px] text-ink-600 hover:border-brand-300"
                                value={toDateInput(f.due_at)}
                                onChange={(e) => e.target.value && reschedule.mutate({ f, date: e.target.value })}
                              />
                              {lead && <Button size="xs" variant="subtle" icon={<Sparkles className="size-3" />} onClick={() => setComposer({ lead, followup: f })}>AI draft</Button>}
                              <Button size="xs" icon={<Check className="size-3" />} onClick={() => setCompleting(f)}>Done</Button>
                              <Button size="xs" variant="ghost" onClick={() => skip.mutate(f)}>Skip</Button>
                              <Button size="xs" variant="ghost" aria-label="Delete" className="text-rose-600 hover:bg-rose-50" onClick={() => setToDelete(f)}><Trash2 className="size-3" /></Button>
                            </>
                          ) : (
                            <Badge tone={f.status === 'completed' ? 'green' : 'slate'}>
                              {f.status === 'completed' ? `Completed ${formatRelative(f.completed_at)}` : 'Skipped'}
                            </Badge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader icon={<AlarmClock className="size-4" />} title="Needs attention" description="Open leads with no follow-up planned and no contact in 7+ days" />
              <CardBody className="space-y-1">
                {needsAttention.length === 0 ? (
                  <p className="py-3 text-center text-sm text-ink-500">Every active lead has a next step.</p>
                ) : (
                  needsAttention.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-lavender-50">
                      <button onClick={() => setOpenLead(l.id)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[13px] font-medium text-ink-900">{l.company}</span>
                        <span className="block truncate text-xs text-ink-500">{l.last_contacted_at ? `Last contact ${formatRelative(l.last_contacted_at)}` : 'Never contacted'}</span>
                      </button>
                      <Button size="xs" variant="subtle" onClick={() => setComposer({ lead: l, followup: null })} aria-label={`AI follow-up for ${l.company}`}><Sparkles className="size-3" /></Button>
                      <Button size="xs" variant="secondary" onClick={() => setSchedule({ lead: l.id })}>Plan</Button>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
            <Alert tone="info" title="How timing works">
              Ask the AI to draft a follow-up — it reads the lead's stage, last contact and history, then recommends a channel and how many days to wait.
            </Alert>
          </div>
        </div>
      )}

      <ScheduleModal
        open={!!schedule}
        onClose={() => setSchedule(null)}
        leads={leads}
        presetLead={schedule?.lead}
        presetDate={schedule?.date}
        presetMessage={schedule?.message}
        presetChannel={schedule?.channel}
      />
      <ComposerModal
        open={!!composer}
        onClose={() => setComposer(null)}
        lead={composer?.lead ?? null}
        followup={composer?.followup ?? null}
        onSchedule={(d) => {
          const lead = composer?.lead;
          setComposer(null);
          setSchedule({ lead: lead?.id, date: toDateInput(addDays(new Date(), d.recommended_days_from_now).toISOString()), message: d.body, channel: d.channel });
        }}
      />
      <CompleteModal followup={completing} lead={completing ? leadById.get(completing.lead_id) ?? null : null} onClose={() => setCompleting(null)} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && del.mutate(toDelete)} loading={del.isPending} title="Delete this follow-up?" message="The follow-up will be permanently removed. The lead and its history stay." />
      <LeadDetailDrawer leadId={openLead} onClose={() => setOpenLead(null)} />
    </div>
  );
}
