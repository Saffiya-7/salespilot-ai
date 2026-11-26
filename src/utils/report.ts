// Analytics report builders (CSV + PDF). All figures come from shared/metrics.
import {
  computeDashboardMetrics,
  followupStats,
  funnel,
  monthlyGrowth,
  segmentPerformance,
  stageDistribution,
  weeklyActivity,
  type DashboardMetrics,
  type FollowupStats,
  type SegmentPerformance,
} from '../../shared/metrics';
import type { Followup, Lead, SalesActivity } from '../../shared/types';
import { rowsToCsv } from '../lib/csv';
import { formatPercent } from './format';

export interface AnalyticsData {
  metrics: DashboardMetrics;
  followups: FollowupStats;
  stages: ReturnType<typeof stageDistribution>;
  funnel: ReturnType<typeof funnel>;
  monthly: ReturnType<typeof monthlyGrowth>;
  industries: SegmentPerformance[];
  sources: SegmentPerformance[];
  weekly: ReturnType<typeof weeklyActivity>;
  activityByType: { name: string; count: number }[];
}

export function buildAnalytics(leads: Lead[], followups: Followup[], activities: SalesActivity[], emailsGenerated: number, now = new Date()): AnalyticsData {
  const byType = new Map<string, number>();
  const cutoff = now.getTime() - 30 * 86_400_000;
  for (const a of activities) if (new Date(a.created_at).getTime() >= cutoff) byType.set(a.type, (byType.get(a.type) ?? 0) + 1);
  return {
    metrics: computeDashboardMetrics(leads, followups, emailsGenerated, now),
    followups: followupStats(followups, now),
    stages: stageDistribution(leads),
    funnel: funnel(leads),
    monthly: monthlyGrowth(leads, 12, now),
    industries: segmentPerformance(leads, (l) => l.industry),
    sources: segmentPerformance(leads, (l) => l.source),
    weekly: weeklyActivity(activities, 8, now),
    activityByType: [...byType.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  };
}

const pct = (n: number | null) => (n === null ? '' : String(n));

export function analyticsCsv(a: AnalyticsData): string {
  const sections: string[] = [];
  const m = a.metrics;
  sections.push(
    rowsToCsv(['Metric', 'Value'], [
      ['Total leads', m.totalLeads],
      ['Qualified leads', m.qualifiedLeads],
      ['High-priority (Hot, open) leads', m.highPriorityLeads],
      ['Won', m.wonLeads],
      ['Lost', m.lostLeads],
      ['Conversion rate % (won / all leads)', pct(m.conversionRate)],
      ['Win rate % (won / closed)', pct(m.winRate)],
      ['Open pipeline value', m.openPipelineValue],
      ['Won value', m.wonValue],
      ['Scored leads', m.scoredLeads],
      ['Average AI score (estimate)', m.averageScore ?? ''],
      ['Emails generated', m.emailsGenerated],
      ['Follow-ups completed', a.followups.completed],
      ['Follow-ups overdue', a.followups.overdue],
      ['Follow-up completion rate %', pct(a.followups.completionRate)],
    ]),
  );
  sections.push(rowsToCsv(['Stage', 'Leads', 'Deal value'], a.stages.map((s) => [s.stage, s.count, s.value])));
  sections.push(rowsToCsv(['Funnel stage', 'Leads reaching stage', '% of all leads'], a.funnel.map((f) => [f.stage, f.reached, pct(f.rate)])));
  sections.push(rowsToCsv(['Month', 'New leads', 'Won'], a.monthly.map((x) => [x.month, x.newLeads, x.won])));
  const seg = (title: string, rows: SegmentPerformance[]) =>
    rowsToCsv([title, 'Leads', 'Won', 'Lost', 'Open', 'Win rate %', 'Conversion %', 'Avg AI score'], rows.map((r) => [r.name, r.total, r.won, r.lost, r.open, pct(r.winRate), pct(r.conversionRate), r.averageScore ?? '']));
  sections.push(seg('Industry', a.industries));
  sections.push(seg('Source', a.sources));
  sections.push(rowsToCsv(['Week starting', 'Activities'], a.weekly.map((w) => [w.start.slice(0, 10), w.total])));
  return sections.join('\r\n\r\n');
}

export async function analyticsPdf(a: AnalyticsData, meta: { account: string; generatedAt?: Date }): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const brand: [number, number, number] = [93, 67, 227];
  const ink: [number, number, number] = [17, 26, 61];

  doc.setFillColor(...brand);
  doc.rect(0, 0, W, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Sumo — Sales Report', 40, 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${meta.account} · Generated ${(meta.generatedAt ?? new Date()).toLocaleString()}`, 40, 70);

  let y = 120;
  const heading = (t: string) => {
    if (y > 740) {
      doc.addPage();
      y = 50;
    }
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(t, 40, y);
    y += 8;
  };
  const table = (head: string[], body: (string | number)[][]) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body: body.map((r) => r.map((c) => String(c))),
      margin: { left: 40, right: 40 },
      styles: { fontSize: 9, cellPadding: 5, textColor: ink },
      headStyles: { fillColor: brand, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 245, 255] },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 28;
  };

  const m = a.metrics;
  heading('Key metrics');
  table(['Metric', 'Value'], [
    ['Total leads', m.totalLeads],
    ['Qualified leads (Interested or later)', m.qualifiedLeads],
    ['High-priority leads (Hot, open)', m.highPriorityLeads],
    ['Won / Lost', `${m.wonLeads} / ${m.lostLeads}`],
    ['Conversion rate (won ÷ all leads)', formatPercent(m.conversionRate)],
    ['Win rate (won ÷ closed)', formatPercent(m.winRate)],
    ['Open pipeline value', m.openPipelineValue.toLocaleString()],
    ['Won value', m.wonValue.toLocaleString()],
    ['Average AI score (estimate)', m.averageScore ?? '—'],
    ['Emails generated', m.emailsGenerated],
    ['Follow-up completion rate', formatPercent(a.followups.completionRate)],
    ['Overdue follow-ups', a.followups.overdue],
  ]);
  heading('Pipeline by stage');
  table(['Stage', 'Leads', 'Deal value'], a.stages.map((s) => [s.stage, s.count, s.value.toLocaleString()]));
  heading('Conversion funnel');
  table(['Stage', 'Leads reaching stage', '% of all leads'], a.funnel.map((f) => [f.stage, f.reached, formatPercent(f.rate)]));
  heading('Monthly growth (last 12 months)');
  table(['Month', 'New leads', 'Won'], a.monthly.map((x) => [x.label, x.newLeads, x.won]));
  const seg = (rows: SegmentPerformance[]) => rows.slice(0, 15).map((r) => [r.name, r.total, r.won, r.lost, formatPercent(r.winRate), r.averageScore ?? '—']);
  heading('Performance by industry');
  table(['Industry', 'Leads', 'Won', 'Lost', 'Win rate', 'Avg AI score'], seg(a.industries));
  heading('Performance by lead source');
  table(['Source', 'Leads', 'Won', 'Lost', 'Win rate', 'Avg AI score'], seg(a.sources));
  heading('Activity (last 8 weeks)');
  table(['Week starting', 'Activities'], a.weekly.map((w) => [w.week, w.total]));

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(138, 146, 177);
    doc.text('AI scores are estimates of fit, not probabilities of conversion. All figures are computed from your stored data.', 40, 820);
    doc.text(`Page ${i} of ${pages}`, W - 80, 820);
  }
  return doc.output('blob');
}
