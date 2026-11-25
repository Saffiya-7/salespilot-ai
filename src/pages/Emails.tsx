import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bookmark,
  BookmarkCheck,
  Copy,
  Download,
  ExternalLink,
  Layers,
  Mail,
  MailCheck,
  RefreshCw,
  Scissors,
  Sparkles,
  Trash2,
  UserRoundPen,
  Wand2,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { EMAIL_TONES, type EmailAction, type EmailTone } from '../../shared/constants';
import { emailRequestSchema, formatZodError } from '../../shared/schemas';
import type { EmailDraft, GeneratedEmail } from '../../shared/types';
import { LeadPicker } from '../components/leads/LeadPicker';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AiLabel, AiThinking, Alert, EmptyState, ErrorNotice } from '../components/ui/Feedback';
import { Input, Textarea } from '../components/ui/Field';
import { ConfirmDialog } from '../components/ui/Modal';
import { PageHeader, Tabs } from '../components/ui/PageHeader';
import { useEmails, useLeads, useProfile, useRefresh } from '../hooks/useData';
import { generateEmail } from '../services/ai';
import { deleteEmail, markEmailSent, setEmailSaved } from '../services/emails';
import { downloadText } from '../utils/download';
import { cn, formatRelative } from '../utils/format';

type Draft = EmailDraft & { id: string | null; saved?: boolean };

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  } catch {
    toast.error('Could not access the clipboard');
  }
}

function emailText(d: { subject: string; body: string }) {
  return `Subject: ${d.subject}\n\n${d.body}`;
}

function mailtoHref(to: string | null | undefined, d: { subject: string; body: string }) {
  const q = `subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body.slice(0, 1800))}`;
  return `mailto:${to ? encodeURIComponent(to) : ''}?${q}`;
}

export default function Emails() {
  const { data: leads = [] } = useLeads();
  const { data: profile } = useProfile();
  const [params] = useSearchParams();
  const refresh = useRefresh();
  const [leadId, setLeadId] = useState<string | null>(params.get('lead'));
  const lead = leads.find((l) => l.id === leadId) ?? null;
  const [form, setForm] = useState({ prospect_name: '', company: '', industry: '', product: '', benefits: '', pain_points: '', instructions: '' });
  const [tone, setTone] = useState<EmailTone>('Professional');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [active, setActive] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<EmailAction>('generate');
  const [libTab, setLibTab] = useState<'saved' | 'recent'>('saved');
  const [toDelete, setToDelete] = useState<GeneratedEmail | null>(null);
  const { data: library = [] } = useEmails(libTab === 'saved');

  useEffect(() => {
    if (profile?.default_tone) setTone(profile.default_tone);
  }, [profile?.default_tone]);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      prospect_name: lead?.contact_name ?? f.prospect_name,
      company: lead?.company ?? f.company,
      industry: lead ? (lead.industry ?? '') : f.industry,
      pain_points: lead ? (lead.requirements ?? lead.research?.likely_challenges?.slice(0, 2).join('; ') ?? '') : f.pain_points,
      product: f.product || [profile?.product_name, profile?.product_description].filter(Boolean).join(' — '),
      benefits: f.benefits || profile?.value_proposition || '',
    }));
  }, [lead, profile]);

  const current = drafts[active] ?? null;

  const run = useMutation({
    mutationFn: async (action: EmailAction) => {
      setLastAction(action);
      const payload = {
        ...form,
        tone,
        action,
        lead_id: leadId ?? undefined,
        existing: action === 'generate' || action === 'variants' ? undefined : current ? { subject: current.subject, body: current.body } : undefined,
      };
      const parsed = emailRequestSchema.safeParse(payload);
      if (!parsed.success) {
        setFormError(formatZodError(parsed.error));
        throw new Error('validation');
      }
      setFormError(null);
      return generateEmail(parsed.data);
    },
    onSuccess: async (r, action) => {
      const next = r.emails.map((e) => ({ ...e, saved: false }));
      if (action === 'generate' || action === 'variants') {
        setDrafts(next);
        setActive(0);
      } else {
        // replace the current draft with the improved one, keep the others
        setDrafts((ds) => ds.map((d, i) => (i === active ? next[0] : d)));
      }
      await refresh('emails', 'emailCount', 'activities');
    },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!d.id) throw new Error('This draft could not be stored. Copy it instead.');
      await setEmailSaved(d.id, !d.saved, { subject: d.subject, body: d.body });
      return !d.saved;
    },
    onSuccess: async (saved) => {
      setDrafts((ds) => ds.map((x, i) => (i === active ? { ...x, saved } : x)));
      toast.success(saved ? 'Saved to your library' : 'Removed from library');
      await refresh('emails');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const sent = useMutation({
    mutationFn: async (d: { id: string | null; subject: string }) => {
      if (!lead) throw new Error('Select a lead first');
      await markEmailSent({ id: d.id ?? '', subject: d.subject }, lead);
    },
    onSuccess: async () => {
      toast.success('Recorded as sent. Last-contacted date updated.');
      await refresh('leads', 'activities');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteEmail(id),
    onSuccess: async () => {
      setToDelete(null);
      toast.success('E-mail deleted');
      await refresh('emails', 'emailCount');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const edit = (patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, i) => (i === active ? { ...d, ...patch, saved: false } : d)));
  const busyLabel = useMemo(
    () => ({ generate: 'Writing your e-mail…', variants: 'Writing 3 alternatives…', rewrite: 'Rewriting…', shorten: 'Shortening…', personalize: 'Improving personalisation…' })[lastAction],
    [lastAction],
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    run.mutate('generate');
  }

  return (
    <div>
      <PageHeader
        eyebrow="AI Tools"
        title="AI Cold Email Generator"
        description="Personalised outreach in five tones. The AI only uses facts you provide — nothing is invented about your prospect, and nothing is sent without you."
      />

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <Card className="h-fit xl:sticky xl:top-24">
          <CardHeader icon={<Mail className="size-4" />} title="Prospect & offer" />
          <CardBody>
            <form onSubmit={submit} className="space-y-4">
              <LeadPicker leads={leads} value={leadId} onChange={setLeadId} label="Write for a lead (optional)" placeholder="Or fill in manually…" />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Input label="Prospect name" required value={form.prospect_name} onChange={set('prospect_name')} placeholder="Priya Sharma" />
                <Input label="Company" required value={form.company} onChange={set('company')} placeholder="Northwind Labs" />
              </div>
              <Input label="Industry" value={form.industry} onChange={set('industry')} placeholder="SaaS / Software" />
              <Textarea label="Your product or service" required rows={2} value={form.product} onChange={set('product')} placeholder="What you sell" />
              <Textarea label="Key benefits" rows={2} value={form.benefits} onChange={set('benefits')} placeholder="e.g. cuts onboarding time in half, no-code setup" />
              <Textarea label="Prospect's pain points" rows={2} value={form.pain_points} onChange={set('pain_points')} placeholder="Only what you know or reasonably expect" />
              <div>
                <div className="label">Tone</div>
                <div className="flex flex-wrap gap-1.5">
                  {EMAIL_TONES.map((t) => (
                    <button key={t} type="button" onClick={() => setTone(t)} className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition', tone === t ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-600 ring-ink-200 hover:ring-brand-300')}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <Input label="Extra instructions (optional)" value={form.instructions} onChange={set('instructions')} placeholder="e.g. mention our free pilot" maxLength={500} />
              {formError && <Alert tone="error">{formError}</Alert>}
              <div className="grid grid-cols-2 gap-2">
                <Button type="submit" icon={<Sparkles className="size-4" />} loading={run.isPending && lastAction === 'generate'} disabled={run.isPending}>
                  Generate
                </Button>
                <Button variant="secondary" icon={<Layers className="size-4" />} onClick={() => run.mutate('variants')} loading={run.isPending && lastAction === 'variants'} disabled={run.isPending}>
                  3 versions
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-4">
          {run.error && (run.error as Error).message !== 'validation' && <ErrorNotice error={run.error} />}

          {run.isPending && (lastAction === 'generate' || lastAction === 'variants' || !current) ? (
            <Card className="p-6"><AiThinking label={busyLabel} lines={7} /></Card>
          ) : current ? (
            <motion.div key={`${active}-${current.subject}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <AiLabel />
                    <Badge tone="brand">{tone}</Badge>
                  </div>
                  {drafts.length > 1 && (
                    <Tabs value={String(active)} onChange={(v) => setActive(Number(v))} options={drafts.map((_, i) => ({ value: String(i), label: `Version ${i + 1}` }))} />
                  )}
                </div>
                <CardBody className="space-y-4 pt-4">
                  {run.isPending && <AiThinking label={busyLabel} lines={2} />}
                  <Input label="Subject" value={current.subject} onChange={(e) => edit({ subject: e.target.value })} />
                  <Textarea label="E-mail body" rows={12} value={current.body} onChange={(e) => edit({ body: e.target.value })} className="font-[450]" />
                  {/\[[^\]]+\]/.test(current.body) && (
                    <Alert tone="warning">Fill in the [bracketed placeholders] before sending — the AI left them where it didn't have verified details.</Alert>
                  )}
                  <details className="group rounded-xl bg-lavender-25 ring-1 ring-ink-100">
                    <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold text-ink-800">E-mail structure ▾</summary>
                    <dl className="grid gap-3 px-4 pb-4 text-[13px] sm:grid-cols-2">
                      {([['Personalised opening', current.opening], ['Problem statement', current.problem_statement], ['Value proposition', current.value_proposition], ['Call to action', current.cta]] as const).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs font-medium text-ink-400">{k}</dt>
                          <dd className="mt-0.5 text-ink-700">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>

                  <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                    <Button size="sm" variant="subtle" icon={<RefreshCw className="size-3.5" />} onClick={() => run.mutate('rewrite')} disabled={run.isPending}>Rewrite</Button>
                    <Button size="sm" variant="subtle" icon={<Scissors className="size-3.5" />} onClick={() => run.mutate('shorten')} disabled={run.isPending}>Shorten</Button>
                    <Button size="sm" variant="subtle" icon={<UserRoundPen className="size-3.5" />} onClick={() => run.mutate('personalize')} disabled={run.isPending}>Improve personalisation</Button>
                    <div className="flex-1" />
                    <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={() => copy(emailText(current))}>Copy</Button>
                    <Button size="sm" variant="secondary" icon={current.saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />} onClick={() => save.mutate(current)} loading={save.isPending}>
                      {current.saved ? 'Saved' : 'Save'}
                    </Button>
                    <Button size="sm" variant="secondary" icon={<Download className="size-3.5" />} onClick={() => downloadText(`email-${(form.company || 'prospect').replace(/\W+/g, '-').toLowerCase()}.txt`, emailText(current))}>Export</Button>
                    <a href={mailtoHref(lead?.email, current)} className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-ink-950 px-3 text-[13px] font-medium text-white hover:bg-ink-800">
                      <ExternalLink className="size-3.5" /> Open in mail app
                    </a>
                    {lead && (
                      <Button size="sm" variant="ghost" icon={<MailCheck className="size-3.5" />} onClick={() => sent.mutate(current)} loading={sent.isPending}>
                        I sent this
                      </Button>
                    )}
                  </div>
                  <p className="text-[11.5px] text-ink-400">SalesPilot never sends e-mail on its own. "Open in mail app" creates a draft in your own e-mail client for you to review and send.</p>
                </CardBody>
              </Card>
            </motion.div>
          ) : (
            <Card>
              <EmptyState
                icon={<Wand2 className="size-6" />}
                title="Write a personalised cold e-mail"
                description="Fill in the prospect and your offer, pick a tone, and generate one e-mail or three different versions. Then rewrite, shorten or sharpen it in one click."
              />
            </Card>
          )}

          <Card>
            <CardHeader
              icon={<Bookmark className="size-4" />}
              title="E-mail library"
              action={<Tabs value={libTab} onChange={setLibTab} options={[{ value: 'saved', label: 'Saved' }, { value: 'recent', label: 'All drafts' }]} />}
            />
            <CardBody>
              {library.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-500">{libTab === 'saved' ? 'Saved e-mails will appear here.' : 'Generated drafts will appear here.'}</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {library.slice(0, 30).map((e) => (
                    <li key={e.id} className="flex items-start gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[13.5px] font-semibold text-ink-900">{e.subject}</span>
                          {e.kind === 'followup' && <Badge tone="blue">Follow-up</Badge>}
                          {e.is_saved && <Badge tone="brand">Saved</Badge>}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-ink-500">
                          {[e.prospect_name, e.company, e.tone].filter(Boolean).join(' · ')} · {formatRelative(e.created_at)}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="xs" variant="ghost" onClick={() => { setDrafts([{ ...e, opening: e.opening ?? '', problem_statement: e.problem_statement ?? '', value_proposition: e.value_proposition ?? '', cta: e.cta ?? '', saved: e.is_saved }]); setActive(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Open</Button>
                        <Button size="xs" variant="ghost" aria-label="Copy" onClick={() => copy(emailText(e))}><Copy className="size-3.5" /></Button>
                        <Button size="xs" variant="ghost" aria-label="Delete" className="text-rose-600 hover:bg-rose-50" onClick={() => setToDelete(e)}><Trash2 className="size-3.5" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        loading={del.isPending}
        title="Delete this e-mail?"
        message={<>“{toDelete?.subject}” will be permanently deleted.</>}
      />
    </div>
  );
}
