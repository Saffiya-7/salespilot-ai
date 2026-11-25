import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Lightbulb, RefreshCw, Sparkles, Target, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { InsightsResult } from '../../shared/types';
import { useAuth } from '../contexts/AuthContext';
import { generateInsights } from '../services/ai';
import { cn, formatRelative } from '../utils/format';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Card, CardBody, CardHeader } from './ui/Card';
import { AiLabel, AiThinking, EmptyState, ErrorNotice } from './ui/Feedback';

const ICON = {
  opportunity: <TrendingUp className="size-4" />,
  risk: <AlertTriangle className="size-4" />,
  action: <Target className="size-4" />,
};
const TINT = {
  opportunity: 'bg-emerald-50 text-emerald-600',
  risk: 'bg-rose-50 text-rose-600',
  action: 'bg-brand-50 text-brand-600',
};

/** AI insights generated on demand from real metrics; the last result is cached in this browser. */
export function InsightsPanel({ scope, hasData, className }: { scope: 'dashboard' | 'analytics'; hasData: boolean; className?: string }) {
  const { user } = useAuth();
  const cacheKey = `salespilot:insights:${scope}:${user?.id}`;
  const [result, setResult] = useState<InsightsResult | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      setResult(raw ? (JSON.parse(raw) as InsightsResult) : null);
    } catch {
      setResult(null);
    }
  }, [cacheKey]);

  const run = useMutation({
    mutationFn: () => generateInsights(scope),
    onSuccess: (r) => {
      setResult(r);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(r));
      } catch {
        /* storage full or disabled — fine */
      }
    },
  });

  return (
    <Card className={className}>
      <CardHeader
        icon={<Sparkles className="size-4" />}
        title={<span className="flex items-center gap-2">AI insights <AiLabel /></span>}
        description={result ? `Based on ${result.based_on.total_leads} leads · ${formatRelative(result.generated_at)}` : 'Generated from your real pipeline data'}
        action={
          hasData && (
            <Button size="sm" variant={result ? 'secondary' : 'primary'} icon={<RefreshCw className="size-3.5" />} loading={run.isPending} onClick={() => run.mutate()}>
              {result ? 'Refresh' : 'Generate'}
            </Button>
          )
        }
      />
      <CardBody>
        {run.isPending ? (
          <AiThinking label="Analysing your pipeline…" />
        ) : run.error ? (
          <ErrorNotice error={run.error} />
        ) : !hasData ? (
          <EmptyState compact icon={<Lightbulb className="size-5" />} title="Insights appear once you have leads" description="Add or import leads, then generate AI insights based on your actual pipeline." />
        ) : result ? (
          <div className="space-y-4">
            <p className="text-[13.5px] leading-relaxed text-ink-700">{result.summary}</p>
            {result.insights.length > 0 && (
              <ul className="space-y-2.5">
                {result.insights.map((ins, i) => (
                  <li key={i} className="flex gap-3 rounded-xl bg-lavender-25 p-3 ring-1 ring-ink-100">
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', TINT[ins.type])}>{ICON[ins.type]}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-ink-900">{ins.title}</span>
                        {ins.priority === 'high' && <Badge tone="red">High priority</Badge>}
                      </div>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-ink-600">{ins.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {result.recommendations.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-semibold tracking-wide text-ink-400 uppercase">Recommended next steps</div>
                <ul className="space-y-1.5">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-ink-700">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <EmptyState compact icon={<Sparkles className="size-5" />} title="Get an AI briefing" description="Gemini reviews your real metrics — pipeline, follow-ups, industries and sources — and suggests where to focus." />
        )}
      </CardBody>
    </Card>
  );
}
