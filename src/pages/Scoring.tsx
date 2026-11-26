import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Gauge, History, Info, Pencil, RefreshCw, ShieldAlert, Sparkles, ThumbsUp, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { SCORE_FACTORS, SCORE_THRESHOLDS } from '../../shared/constants';
import { scoreBuckets } from '../../shared/metrics';
import type { LeadScore } from '../../shared/types';
import { LeadFormModal } from '../components/leads/LeadFormModal';
import { LeadPicker } from '../components/leads/LeadPicker';
import { ScoreBadge, StageBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AiLabel, AiThinking, Alert, EmptyState, ErrorNotice } from '../components/ui/Feedback';
import { PageHeader, Tabs } from '../components/ui/PageHeader';
import { useLeads, useLeadScores, useRefresh } from '../hooks/useData';
import { scoreLead } from '../services/ai';
import { cn, formatDate, formatRelative } from '../utils/format';

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const color = score >= SCORE_THRESHOLDS.hot ? '#f43f5e' : score >= SCORE_THRESHOLDS.warm ? '#f59e0b' : '#0ea5e9';
  return (
    <div className="relative size-36">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#eceef6" strokeWidth="10" />
        <motion.circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (score / 100) * c }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-4xl font-bold text-ink-950">{score}</div>
          <div className="text-xs font-semibold" style={{ color }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function ScoreDetail({ s }: { s: LeadScore }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card>
        <CardBody className="flex flex-col gap-6 pt-5 sm:flex-row sm:items-center">
          <ScoreRing score={s.score} label={s.label} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <AiLabel>AI estimate</AiLabel>
              {s.data_completeness && (
                <span className={cn('text-xs font-medium', s.data_completeness === 'low' ? 'text-amber-700' : 'text-ink-500')}>
                  Data completeness: {s.data_completeness}
                </span>
              )}
              <span className="text-xs text-ink-400">· {formatRelative(s.created_at)}</span>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-700">{s.explanation}</p>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[13.5px] text-brand-900">
              <Zap className="mt-0.5 size-4 shrink-0 text-brand-600" />
              <span><strong>Recommended next action:</strong> {s.next_action}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={<Gauge className="size-4" />} title="Factor breakdown" description="Each factor scored 0–10 from the lead's data" />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          {SCORE_FACTORS.map((f, i) => {
            const fx = s.factors?.[f.key];
            const v = fx?.score ?? 0;
            return (
              <div key={f.key} className="rounded-xl bg-lavender-25 p-3 ring-1 ring-ink-100">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-ink-800">{f.label}</span>
                  <span className="font-semibold text-ink-900 tabular-nums">{v}/10</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-ink-100">
                  <motion.div className="h-full rounded-full bg-linear-to-r from-brand-400 to-brand-600" initial={{ width: 0 }} animate={{ width: `${v * 10}%` }} transition={{ delay: 0.1 + i * 0.05, duration: 0.6 }} />
                </div>
                {fx?.reason && <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{fx.reason}</p>}
              </div>
            );
          })}
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader icon={<ThumbsUp className="size-4" />} title="Positive indicators" />
          <CardBody>
            <ul className="space-y-2">
              {s.positive_indicators.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] text-ink-700"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" />{p}</li>
              ))}
              {!s.positive_indicators.length && <li className="text-sm text-ink-500">None identified.</li>}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<ShieldAlert className="size-4" />} title="Risk factors" />
          <CardBody>
            <ul className="space-y-2">
              {s.risk_factors.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] text-ink-700"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-rose-500" />{p}</li>
              ))}
              {!s.risk_factors.length && <li className="text-sm text-ink-500">None identified.</li>}
            </ul>
          </CardBody>
        </Card>
      </div>
    </motion.div>
  );
}

export default function Scoring() {
  const { data: leads = [], isLoading } = useLeads();
  const [params] = useSearchParams();
  const [leadId, setLeadId] = useState<string | null>(params.get('lead'));
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState<'unscored' | 'all'>('unscored');
  const refresh = useRefresh();
  const lead = leads.find((l) => l.id === leadId) ?? null;
  const { data: history = [] } = useLeadScores(leadId ?? undefined);
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const shown = history.find((h) => h.id === selectedScoreId) ?? history[0] ?? null;
  const buckets = useMemo(() => scoreBuckets(leads), [leads]);
  const queue = useMemo(
    () => (view === 'unscored' ? leads.filter((l) => l.score === null && l.status !== 'Won' && l.status !== 'Lost') : [...leads].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))).slice(0, 30),
    [leads, view],
  );

  const run = useMutation({
    mutationFn: (id: string) => scoreLead(id),
    onSuccess: async (r) => {
      toast.success(`Scored ${r.result.score}/100 (${r.result.label})`);
      setSelectedScoreId(null);
      await refresh('leads', 'activities', 'scores');
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="AI Tools"
        title="AI Lead Scoring"
        description="Estimate how promising each lead is across seven factors, with the reasoning shown. Scores are AI estimates of fit and priority — not probabilities of closing."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: 'Hot', v: buckets.hot, c: 'text-rose-600 bg-rose-50 ring-rose-100', d: `${SCORE_THRESHOLDS.hot}+` },
          { k: 'Warm', v: buckets.warm, c: 'text-amber-700 bg-amber-50 ring-amber-100', d: `${SCORE_THRESHOLDS.warm}–${SCORE_THRESHOLDS.hot - 1}` },
          { k: 'Cold', v: buckets.cold, c: 'text-sky-700 bg-sky-50 ring-sky-100', d: `below ${SCORE_THRESHOLDS.warm}` },
          { k: 'Not scored', v: buckets.unscored, c: 'text-ink-600 bg-white ring-ink-100', d: 'awaiting AI score' },
        ].map((b) => (
          <div key={b.k} className={cn('rounded-2xl p-4 ring-1', b.c)}>
            <div className="text-xs font-semibold">{b.k}</div>
            <div className="mt-1 font-display text-2xl font-bold">{b.v}</div>
            <div className="text-[11px] opacity-70">{b.d}</div>
          </div>
        ))}
      </div>

      {!isLoading && leads.length === 0 ? (
        <Card>
          <EmptyState icon={<Gauge className="size-6" />} title="No leads to score yet" description="Add leads first — then Sumo can estimate which ones deserve your time." />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader icon={<Sparkles className="size-4" />} title="Score a lead" />
              <CardBody className="space-y-4">
                <LeadPicker leads={leads} value={leadId} onChange={(id) => { setLeadId(id); setSelectedScoreId(null); }} />
                {lead && (
                  <div className="rounded-xl bg-lavender-25 p-3 text-[13px] ring-1 ring-ink-100">
                    <div className="flex items-center justify-between gap-2">
                      <StageBadge stage={lead.status} />
                      <ScoreBadge score={lead.score} label={lead.score_label} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div><dt className="text-ink-400">Industry</dt><dd className="text-ink-700">{lead.industry ?? '—'}</dd></div>
                      <div><dt className="text-ink-400">Size</dt><dd className="text-ink-700">{lead.company_size ?? '—'}</dd></div>
                      <div><dt className="text-ink-400">Role</dt><dd className="truncate text-ink-700">{lead.job_title ?? '—'}</dd></div>
                      <div><dt className="text-ink-400">Budget</dt><dd className="truncate text-ink-700">{lead.budget ?? '—'}</dd></div>
                    </dl>
                    {!lead.requirements && !lead.job_title && !lead.industry && (
                      <p className="mt-3 flex gap-1.5 text-xs text-amber-700"><Info className="size-3.5 shrink-0" /> Little data on this lead — the estimate will be cautious. Add details for a better score.</p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button className="flex-1" icon={lead?.score !== null && lead ? <RefreshCw className="size-4" /> : <Gauge className="size-4" />} disabled={!lead} loading={run.isPending} onClick={() => lead && run.mutate(lead.id)}>
                    {lead?.score !== null && lead ? 'Regenerate score' : 'Score with AI'}
                  </Button>
                  <Button variant="secondary" icon={<Pencil className="size-4" />} disabled={!lead} onClick={() => setEditing(true)} aria-label="Edit lead info">
                    Edit info
                  </Button>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Scoring queue"
                action={<Tabs value={view} onChange={setView} options={[{ value: 'unscored', label: 'Unscored', count: buckets.unscored }, { value: 'all', label: 'Top scored' }]} />}
              />
              <CardBody className="space-y-1">
                {queue.length === 0 && <p className="py-4 text-center text-sm text-ink-500">{view === 'unscored' ? 'Every open lead has a score 🎉' : 'No leads yet.'}</p>}
                {queue.map((l) => (
                  <button key={l.id} onClick={() => { setLeadId(l.id); setSelectedScoreId(null); }} className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-lavender-50', l.id === leadId && 'bg-brand-50')}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink-900">{l.company}</span>
                      <span className="block truncate text-xs text-ink-500">{l.contact_name}</span>
                    </span>
                    <ScoreBadge score={l.score} label={l.score_label} compact />
                  </button>
                ))}
              </CardBody>
            </Card>
          </div>

          <div className="min-w-0 space-y-4">
            {run.isPending ? (
              <Card className="p-6"><AiThinking label={`Scoring ${lead?.company ?? 'lead'}…`} lines={6} /></Card>
            ) : run.error ? (
              <ErrorNotice error={run.error} />
            ) : null}
            {!run.isPending && shown ? (
              <>
                <ScoreDetail s={shown} />
                {history.length > 1 && (
                  <Card>
                    <CardHeader icon={<History className="size-4" />} title="Score history" description="Earlier estimates for this lead" />
                    <CardBody className="flex flex-wrap gap-2">
                      {history.map((h) => (
                        <button key={h.id} onClick={() => setSelectedScoreId(h.id)} className={cn('rounded-xl px-3 py-2 text-left text-xs ring-1 transition', h.id === shown.id ? 'bg-brand-50 ring-brand-200' : 'bg-white ring-ink-100 hover:ring-brand-200')}>
                          <div className="font-semibold text-ink-900">{h.score} · {h.label}</div>
                          <div className="text-ink-500">{formatDate(h.created_at)}</div>
                        </button>
                      ))}
                    </CardBody>
                  </Card>
                )}
              </>
            ) : !run.isPending && (
              <Card>
                <EmptyState
                  icon={<Gauge className="size-6" />}
                  title={lead ? 'This lead has not been scored yet' : 'Select a lead to score'}
                  description="The AI weighs industry relevance, company size, requirements, budget indicators, decision-maker relevance, product fit and engagement."
                />
              </Card>
            )}
            <Alert tone="info">Scores are AI estimates based only on the data stored for each lead. They are not probabilities of winning the deal. Add details and regenerate to refine them.</Alert>
          </div>
        </div>
      )}

      <LeadFormModal open={editing} onClose={() => setEditing(false)} lead={lead} />
    </div>
  );
}
