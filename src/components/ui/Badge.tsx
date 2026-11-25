import { Flame, Snowflake, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PipelineStage, ScoreLabel } from '../../../shared/constants';
import { cn } from '../../utils/format';

export type Tone = 'neutral' | 'brand' | 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate';

const tones: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200/60',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200/70',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200/70',
  red: 'bg-rose-50 text-rose-700 ring-rose-200/70',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200/70',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/70',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200/70',
};

export function Badge({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap ring-1 ring-inset', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export const STAGE_TONE: Record<PipelineStage, Tone> = {
  'New Lead': 'slate',
  Contacted: 'blue',
  Interested: 'violet',
  'Meeting Scheduled': 'brand',
  'Proposal Sent': 'amber',
  Negotiation: 'amber',
  Won: 'green',
  Lost: 'red',
};

export const STAGE_DOT: Record<PipelineStage, string> = {
  'New Lead': 'bg-slate-400',
  Contacted: 'bg-sky-500',
  Interested: 'bg-violet-500',
  'Meeting Scheduled': 'bg-brand-500',
  'Proposal Sent': 'bg-amber-500',
  Negotiation: 'bg-orange-500',
  Won: 'bg-emerald-500',
  Lost: 'bg-rose-500',
};

export function StageBadge({ stage }: { stage: PipelineStage }) {
  return (
    <Badge tone={STAGE_TONE[stage] ?? 'neutral'}>
      <span className={cn('size-1.5 rounded-full', STAGE_DOT[stage])} />
      {stage}
    </Badge>
  );
}

export function ScoreBadge({ score, label, compact }: { score: number | null | undefined; label: ScoreLabel | null | undefined; compact?: boolean }) {
  const map = label ? SCORE_STYLE[label] : undefined;
  if (score === null || score === undefined || !map) {
    return <Badge tone="neutral">Not scored</Badge>;
  }
  return (
    <Badge tone={map.tone} icon={map.icon}>
      {compact ? score : `${label} · ${score}`}
    </Badge>
  );
}

const SCORE_STYLE: Record<ScoreLabel, { tone: Tone; icon: ReactNode }> = {
  Hot: { tone: 'red', icon: <Flame className="size-3" /> },
  Warm: { tone: 'amber', icon: <Sun className="size-3" /> },
  Cold: { tone: 'blue', icon: <Snowflake className="size-3" /> },
};
