import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  FileUp,
  Flame,
  Mail,
  PieChart as PieIcon,
  Plus,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { computeDashboardMetrics, followupUrgency, monthlyGrowth, sourceDistribution, stageDistribution } from '../../shared/metrics';
import { DonutChart, LeadGrowthChart, StageBarChart } from '../components/charts/Charts';
import { InsightsPanel } from '../components/InsightsPanel';
import { ActivityTimeline } from '../components/leads/ActivityTimeline';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer';
import { LeadFormModal } from '../components/leads/LeadFormModal';
import { Badge, ScoreBadge, StageBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { EmptyState, ErrorNotice, Skeleton } from '../components/ui/Feedback';
import { PageHeader, StatCard } from '../components/ui/PageHeader';
import { useActivities, useEmailCount, useFollowups, useLeads, useProfile } from '../hooks/useData';
import { cn, formatDate, formatPercent, formatRelative, initials } from '../utils/format';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const leadsQ = useLeads();
  const followupsQ = useFollowups();
  const activitiesQ = useActivities(200);
  const emailCountQ = useEmailCount();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [openLead, setOpenLead] = useState<string | null>(null);

  const leads = useMemo(() => leadsQ.data ?? [], [leadsQ.data]);
  const followups = useMemo(() => followupsQ.data ?? [], [followupsQ.data]);
  const activities = activitiesQ.data ?? [];
  const loading = leadsQ.isLoading || followupsQ.isLoading || emailCountQ.isLoading;
  const error = leadsQ.error || followupsQ.error || activitiesQ.error || emailCountQ.error;

  const metrics = useMemo(() => computeDashboardMetrics(leads, followups, emailCountQ.data ?? 0), [leads, followups, emailCountQ.data]);
  const growth = useMemo(() => monthlyGrowth(leads, 6), [leads]);
  const stages = useMemo(() => stageDistribution(leads), [leads]);
  const sources = useMemo(() => sourceDistribution(leads), [leads]);
  const leadName = useMemo(() => new Map(leads.map((l) => [l.id, l.contact_name])), [leads]);
  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const upcoming = useMemo(() => followups.filter((f) => f.status === 'pending').slice(0, 6), [followups]);
  const firstName = profile?.full_name?.split(' ')[0];

  const onboarding = [
    { done: Boolean(profile?.product_name || profile?.product_description), label: 'Describe what you sell', hint: 'Helps the AI judge fit and write better e-mails', to: '/app/settings' },
    { done: leads.length > 0, label: 'Add or import your leads', hint: 'Manually or from a CSV', to: '/app/leads?new=1' },
    { done: metrics.scoredLeads > 0, label: 'Score a lead with AI', hint: 'See who to prioritise', to: '/app/scoring' },
    { done: (emailCountQ.data ?? 0) > 0, label: 'Generate your first e-mail', hint: 'Personalised cold outreach', to: '/app/emails' },
    { done: followups.length > 0, label: 'Schedule a follow-up', hint: 'Never let a lead go cold', to: '/app/followups' },
  ];
  const onboardingDone = onboarding.filter((s) => s.done).length;

  return (
    <div>
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={leads.length ? 'Here is where your pipeline stands today — every number comes from your own data.' : 'Welcome to Sumo. Let’s set up your workspace.'}
        actions={
          <>
            <Button variant="secondary" icon={<FileUp className="size-4" />} onClick={() => navigate('/app/leads?import=1')}>Import CSV</Button>
            <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Add lead</Button>
          </>
        }
      />

      {error && <ErrorNotice error={error} className="mb-5" />}

      {!loading && onboardingDone < onboarding.length && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 overflow-hidden rounded-2xl border border-brand-100 bg-linear-to-br from-white via-white to-brand-50 shadow-card">
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
            <div className="lg:w-72">
              <div className="text-xs font-semibold tracking-wider text-brand-600 uppercase">Getting started</div>
              <h2 className="mt-1 text-lg font-bold">Set up your sales co-pilot</h2>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-brand-100">
                  <motion.div className="h-full rounded-full bg-brand-600" initial={{ width: 0 }} animate={{ width: `${(onboardingDone / onboarding.length) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-ink-600">{onboardingDone}/{onboarding.length}</span>
              </div>
            </div>
            <ol className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {onboarding.map((s) => (
                <li key={s.label}>
                  <Link to={s.to} className={cn('flex h-full items-start gap-2.5 rounded-xl p-3 ring-1 transition', s.done ? 'bg-emerald-50/60 ring-emerald-100' : 'bg-white ring-ink-100 hover:ring-brand-200')}>
                    {s.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" /> : <Circle className="mt-0.5 size-4 shrink-0 text-ink-300" />}
                    <span>
                      <span className={cn('block text-[13px] font-semibold', s.done ? 'text-emerald-800 line-through decoration-emerald-300' : 'text-ink-900')}>{s.label}</span>
                      <span className="block text-[11.5px] text-ink-500">{s.hint}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </motion.div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[112px] rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Total Leads" value={metrics.totalLeads.toLocaleString()} icon={<Users className="size-4" />} hint={`${growth[growth.length - 1]?.newLeads ?? 0} added this month`} />
            <StatCard label="Qualified Leads" value={metrics.qualifiedLeads.toLocaleString()} icon={<UserCheck className="size-4" />} accent="violet" hint="Interested stage or later" delay={0.03} />
            <StatCard label="High-Priority Leads" value={metrics.highPriorityLeads.toLocaleString()} icon={<Flame className="size-4" />} accent="red" hint={metrics.scoredLeads ? `Open & AI-scored Hot · ${metrics.scoredLeads} scored` : 'Score leads to find them'} delay={0.06} />
            <StatCard label="Emails Generated" value={(emailCountQ.data ?? 0).toLocaleString()} icon={<Mail className="size-4" />} accent="blue" hint="AI drafts, incl. follow-ups" delay={0.09} />
            <StatCard
              label="Follow-ups Due"
              value={metrics.followupsDue.toLocaleString()}
              icon={<CalendarClock className="size-4" />}
              accent="amber"
              hint={metrics.overdueFollowups ? <span className="font-medium text-rose-600">{metrics.overdueFollowups} overdue</span> : 'Today, incl. overdue'}
              delay={0.12}
            />
            <StatCard
              label="Conversion Rate"
              value={formatPercent(metrics.conversionRate)}
              icon={<TrendingUp className="size-4" />}
              accent="green"
              hint={metrics.totalLeads ? `${metrics.wonLeads} won of ${metrics.totalLeads} leads` : 'No leads yet'}
              delay={0.15}
            />
          </>
        )}
      </div>

      {!loading && leads.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={<Target className="size-6" />}
            title="Your dashboard comes alive with your first leads"
            description="Charts, conversion metrics and AI insights are calculated from the leads you add. Nothing here is sample data."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Add a lead</Button>
                <Button variant="secondary" icon={<FileUp className="size-4" />} onClick={() => navigate('/app/leads?import=1')}>Import CSV</Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader icon={<TrendingUp className="size-4" />} title="Lead growth" description="New and won leads per month (last 6 months)" />
              <CardBody>{loading ? <Skeleton className="h-60" /> : <LeadGrowthChart data={growth} />}</CardBody>
            </Card>
            <Card>
              <CardHeader icon={<PieIcon className="size-4" />} title="Lead sources" description="Where your leads come from" />
              <CardBody>{loading ? <Skeleton className="h-60" /> : <DonutChart data={sources} centerLabel="leads" />}</CardBody>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                icon={<Target className="size-4" />}
                title="Pipeline by stage"
                description={`${metrics.totalLeads - metrics.wonLeads - metrics.lostLeads} open · ${metrics.wonLeads} won · ${metrics.lostLeads} lost`}
                action={<Link to="/app/pipeline" className="text-xs font-semibold text-brand-700 hover:underline">Open pipeline →</Link>}
              />
              <CardBody>{loading ? <Skeleton className="h-60" /> : <StageBarChart data={stages} />}</CardBody>
            </Card>
            <InsightsPanel scope="dashboard" hasData={leads.length > 0} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader icon={<Users className="size-4" />} title="Recent leads" action={<Link to="/app/leads" className="text-xs font-semibold text-brand-700 hover:underline">View all →</Link>} />
              <CardBody className="space-y-1">
                {leads.slice(0, 6).map((l) => (
                  <button key={l.id} onClick={() => setOpenLead(l.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-lavender-50">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">{initials(l.contact_name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink-900">{l.contact_name}</span>
                      <span className="block truncate text-xs text-ink-500">{l.company}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <ScoreBadge score={l.score} label={l.score_label} compact />
                      <span className="text-[11px] text-ink-400">{formatRelative(l.created_at)}</span>
                    </span>
                  </button>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader icon={<CalendarClock className="size-4" />} title="Upcoming follow-ups" action={<Link to="/app/followups" className="text-xs font-semibold text-brand-700 hover:underline">Manage →</Link>} />
              <CardBody>
                {upcoming.length === 0 ? (
                  <EmptyState compact icon={<CalendarClock className="size-5" />} title="No follow-ups scheduled" description="Schedule follow-ups so promising leads don't go cold." action={<Button size="sm" variant="subtle" onClick={() => navigate('/app/followups')}>Schedule one</Button>} />
                ) : (
                  <ul className="space-y-1">
                    {upcoming.map((f) => {
                      const u = followupUrgency(f.due_at);
                      const lead = leadById.get(f.lead_id);
                      return (
                        <li key={f.id}>
                          <button onClick={() => setOpenLead(f.lead_id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-lavender-50">
                            <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg text-[10px] leading-tight font-bold', u === 'overdue' ? 'bg-rose-50 text-rose-600' : u === 'today' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700')}>
                              {formatDate(f.due_at, { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-medium text-ink-900">{lead?.contact_name ?? 'Lead'}</span>
                              <span className="block truncate text-xs text-ink-500 capitalize">{f.channel}{lead ? ` · ${lead.company}` : ''}</span>
                            </span>
                            {u === 'overdue' ? <Badge tone="red">Overdue</Badge> : u === 'today' ? <Badge tone="amber">Today</Badge> : lead && <StageBadge stage={lead.status} />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card className="lg:col-span-2 xl:col-span-1">
              <CardHeader icon={<Activity className="size-4" />} title="Recent activity" action={<Link to="/app/analytics" className="text-xs font-semibold text-brand-700 hover:underline">Reports <ArrowRight className="inline size-3" /></Link>} />
              <CardBody>
                {activitiesQ.isLoading ? (
                  <Skeleton className="h-48" />
                ) : activities.length ? (
                  <ActivityTimeline activities={activities.slice(0, 7)} leadNames={leadName} compact />
                ) : (
                  <p className="text-sm text-ink-500">No activity yet.</p>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <LeadFormModal open={adding} onClose={() => setAdding(false)} />
      <LeadDetailDrawer leadId={openLead} onClose={() => setOpenLead(null)} />
    </div>
  );
}
