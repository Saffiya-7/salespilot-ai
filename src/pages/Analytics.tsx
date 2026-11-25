import { Activity, BarChart3, Building2, CalendarCheck, Download, FileText, Filter, Percent, Radio, Target, TrendingUp, Trophy, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import type { SegmentPerformance } from '../../shared/metrics';
import { DonutChart, HorizontalBars, LeadGrowthChart, StageBarChart } from '../components/charts/Charts';
import { InsightsPanel } from '../components/InsightsPanel';
import { ACTIVITY_META } from '../components/leads/ActivityTimeline';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { EmptyState, ErrorNotice, Skeleton } from '../components/ui/Feedback';
import { PageHeader, StatCard, Tabs } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { useActivities, useEmailCount, useFollowups, useLeads, useProfile } from '../hooks/useData';
import { dateStamp, downloadBlob, downloadText } from '../utils/download';
import { formatMoney, formatPercent } from '../utils/format';
import { analyticsCsv, analyticsPdf, buildAnalytics } from '../utils/report';
import type { ActivityType } from '../../shared/constants';

function SegmentTable({ rows, label }: { rows: SegmentPerformance[]; label: string }) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="min-w-full text-left text-[13px]">
        <thead className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
          <tr className="border-b border-ink-100">
            <th className="py-2 pr-3">{label}</th>
            <th className="px-2 py-2 text-right">Leads</th>
            <th className="px-2 py-2 text-right">Won</th>
            <th className="px-2 py-2 text-right">Lost</th>
            <th className="px-2 py-2 text-right">Win rate</th>
            <th className="py-2 pl-2 text-right">Avg score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.slice(0, 10).map((r) => (
            <tr key={r.name}>
              <td className="max-w-[200px] truncate py-2 pr-3 font-medium text-ink-800">{r.name}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.total}</td>
              <td className="px-2 py-2 text-right text-emerald-700 tabular-nums">{r.won}</td>
              <td className="px-2 py-2 text-right text-rose-600 tabular-nums">{r.lost}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatPercent(r.winRate)}</td>
              <td className="py-2 pl-2 text-right tabular-nums">{r.averageScore ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Analytics() {
  const leadsQ = useLeads();
  const followupsQ = useFollowups();
  const activitiesQ = useActivities(2000);
  const emailsQ = useEmailCount();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [stageMetric, setStageMetric] = useState<'count' | 'value'>('count');
  const [pdfLoading, setPdfLoading] = useState(false);
  const loading = leadsQ.isLoading || followupsQ.isLoading || activitiesQ.isLoading;
  const error = leadsQ.error || followupsQ.error || activitiesQ.error;
  const leads = leadsQ.data ?? [];

  const a = useMemo(
    () => buildAnalytics(leadsQ.data ?? [], followupsQ.data ?? [], activitiesQ.data ?? [], emailsQ.data ?? 0),
    [leadsQ.data, followupsQ.data, activitiesQ.data, emailsQ.data],
  );

  const exportCsv = () => downloadText(`salespilot-report-${dateStamp()}.csv`, analyticsCsv(a), 'text/csv;charset=utf-8');
  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const blob = await analyticsPdf(a, { account: profile?.company_name || profile?.full_name || user?.email || 'Your workspace' });
      downloadBlob(`salespilot-report-${dateStamp()}.pdf`, blob);
    } catch (e) {
      toast.error(`Could not create the PDF: ${(e as Error).message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  const m = a.metrics;

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Sales Analytics"
        description="Conversion, pipeline performance, industries, sources and activity — calculated live from your stored data."
        actions={
          <>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv} disabled={!leads.length}>CSV report</Button>
            <Button icon={<FileText className="size-4" />} onClick={exportPdf} loading={pdfLoading} disabled={!leads.length}>PDF report</Button>
          </>
        }
      />
      {error && <ErrorNotice error={error} className="mb-4" />}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : !leads.length ? (
        <Card>
          <EmptyState icon={<BarChart3 className="size-6" />} title="No data to analyse yet" description="Analytics are computed from your leads, follow-ups and activities. Add leads and work your pipeline to see conversion and performance here." />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
            <StatCard label="Conversion rate" value={formatPercent(m.conversionRate)} icon={<Percent className="size-4" />} accent="green" hint={`${m.wonLeads} won of ${m.totalLeads}`} />
            <StatCard label="Win rate" value={formatPercent(m.winRate)} icon={<Trophy className="size-4" />} accent="violet" hint={m.wonLeads + m.lostLeads ? `${m.wonLeads + m.lostLeads} closed deals` : 'No closed deals yet'} />
            <StatCard label="Open pipeline" value={formatMoney(m.openPipelineValue)} icon={<Wallet className="size-4" />} hint="Sum of deal values in open stages" />
            <StatCard label="Won value" value={formatMoney(m.wonValue)} icon={<TrendingUp className="size-4" />} accent="green" />
            <StatCard label="Avg AI score" value={m.averageScore ?? '—'} icon={<Target className="size-4" />} accent="red" hint={`${m.scoredLeads} of ${m.totalLeads} scored (estimate)`} />
            <StatCard label="Follow-up completion" value={formatPercent(a.followups.completionRate)} icon={<CalendarCheck className="size-4" />} accent="amber" hint={`${a.followups.completed} done · ${a.followups.overdue} overdue`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader icon={<TrendingUp className="size-4" />} title="Monthly growth" description="New leads and deals won per month (last 12 months)" />
              <CardBody><LeadGrowthChart data={a.monthly} height={260} /></CardBody>
            </Card>
            <Card>
              <CardHeader icon={<Filter className="size-4" />} title="Conversion funnel" description="Leads that reached each stage (Lost excluded)" />
              <CardBody className="space-y-2.5">
                {a.funnel.map((f, i) => (
                  <div key={f.stage}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-ink-700">{f.stage}</span>
                      <span className="text-ink-500 tabular-nums">{f.reached} · {formatPercent(f.rate)}</span>
                    </div>
                    <div className="mt-1 h-2.5 rounded-full bg-ink-100">
                      <div className="h-full rounded-full" style={{ width: `${f.rate ?? 0}%`, background: `hsl(${250 - i * 18} 75% ${58 + i * 2}%)` }} />
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader
                icon={<BarChart3 className="size-4" />}
                title="Pipeline performance"
                description={stageMetric === 'count' ? 'Leads per stage' : 'Deal value per stage'}
                action={<Tabs value={stageMetric} onChange={setStageMetric} options={[{ value: 'count', label: 'Leads' }, { value: 'value', label: 'Value' }]} />}
              />
              <CardBody><StageBarChart data={a.stages} metric={stageMetric} height={260} /></CardBody>
            </Card>
            <Card>
              <CardHeader icon={<Building2 className="size-4" />} title="Industry distribution" description="Leads per industry" />
              <CardBody>
                <HorizontalBars data={a.industries.slice(0, 8).map((r) => ({ name: r.name, value: r.total }))} />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader icon={<Building2 className="size-4" />} title="Industry performance" description="Which industries convert best" />
              <CardBody><SegmentTable rows={a.industries} label="Industry" /></CardBody>
            </Card>
            <Card>
              <CardHeader icon={<Radio className="size-4" />} title="Lead sources" description="Volume and performance by source" />
              <CardBody className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <DonutChart data={a.sources.map((s) => ({ name: s.name, count: s.total }))} height={220} centerLabel="leads" />
                <SegmentTable rows={a.sources} label="Source" />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader icon={<Activity className="size-4" />} title="Activity report" description="Logged sales activities per week (last 8 weeks)" />
              <CardBody>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={a.weekly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#eceef6" vertical={false} />
                    <XAxis dataKey="week" stroke="#8a92b1" fontSize={11.5} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke="#8a92b1" fontSize={11.5} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#f0edfe' }} contentStyle={{ borderRadius: 12, border: '1px solid #eceef6', fontSize: 12 }} />
                    <Bar dataKey="total" name="Activities" fill="#7058f2" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Last 30 days by type" />
              <CardBody>
                {a.activityByType.length === 0 ? (
                  <p className="text-sm text-ink-500">No activity in the last 30 days.</p>
                ) : (
                  <ul className="space-y-2">
                    {a.activityByType.map((t) => {
                      const meta = ACTIVITY_META[t.name as ActivityType];
                      return (
                        <li key={t.name} className="flex items-center gap-2.5 text-[13px]">
                          <span className={`grid size-6 place-items-center rounded-full ${meta?.color ?? 'bg-ink-100'}`}>{meta?.icon}</span>
                          <span className="flex-1 text-ink-700">{meta?.label ?? t.name}</span>
                          <span className="font-semibold text-ink-900 tabular-nums">{t.count}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <InsightsPanel scope="analytics" hasData={leads.length > 0} />
        </div>
      )}
    </div>
  );
}
