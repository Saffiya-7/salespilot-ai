import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyPoint, NamedCount, StagePoint } from '../../../shared/metrics';

export const CHART_COLORS = ['#5d43e3', '#8b78fa', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#64748b', '#a855f7', '#14b8a6'];

export const STAGE_COLORS: Record<string, string> = {
  'New Lead': '#94a3b8',
  Contacted: '#0ea5e9',
  Interested: '#8b5cf6',
  'Meeting Scheduled': '#7058f2',
  'Proposal Sent': '#f59e0b',
  Negotiation: '#f97316',
  Won: '#10b981',
  Lost: '#f43f5e',
};

const axis = { stroke: '#8a92b1', fontSize: 11.5, tickLine: false, axisLine: false } as const;

function TooltipBox({ active, payload, label, unit }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: Record<string, unknown> }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-100 bg-white/95 px-3 py-2 text-xs shadow-pop backdrop-blur">
      {label && <div className="mb-1 font-semibold text-ink-900">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-ink-600">
          <span className="size-2 rounded-full" style={{ background: p.color ?? (p.payload?.fill as string) }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-semibold text-ink-900 tabular-nums">
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LeadGrowthChart({ data, height = 240, showWon = true }: { data: MonthlyPoint[]; height?: number; showWon?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7058f2" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#7058f2" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gWon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#eceef6" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip content={<TooltipBox />} cursor={{ stroke: '#ccc4ff', strokeDasharray: 4 }} />
        <Area type="monotone" dataKey="newLeads" name="New leads" stroke="#5d43e3" strokeWidth={2.4} fill="url(#gNew)" />
        {showWon && <Area type="monotone" dataKey="won" name="Won" stroke="#10b981" strokeWidth={2} fill="url(#gWon)" />}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StageBarChart({ data, height = 240, metric = 'count' }: { data: StagePoint[]; height?: number; metric?: 'count' | 'value' }) {
  const rows = data.map((d) => ({ ...d, short: d.stage.replace('Meeting Scheduled', 'Meeting').replace('Proposal Sent', 'Proposal').replace('Negotiation', 'Negot.') }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#eceef6" vertical={false} />
        <XAxis dataKey="short" {...axis} interval={0} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: '#f0edfe' }} />
        <Bar dataKey={metric} name={metric === 'count' ? 'Leads' : 'Deal value'} radius={[6, 6, 0, 0]} maxBarSize={38}>
          {rows.map((r) => (
            <Cell key={r.stage} fill={STAGE_COLORS[r.stage]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 240, centerLabel }: { data: NamedCount[]; height?: number; centerLabel?: string }) {
  const total = data.reduce((a, b) => a + b.count, 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<TooltipBox />} />
          <Pie data={data} dataKey="count" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">
            {data.map((d, i) => (
              <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(v: string) => <span className="text-[11.5px] text-ink-600">{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[38%] -translate-y-1/2 text-center">
        <div className="font-display text-2xl font-bold text-ink-950">{total.toLocaleString()}</div>
        <div className="text-[11px] text-ink-500">{centerLabel ?? 'total'}</div>
      </div>
    </div>
  );
}

export function HorizontalBars({ data, height, unit, color = '#7058f2', valueKey = 'value', nameKey = 'name' }: { data: Record<string, string | number | null>[]; height?: number; unit?: string; color?: string; valueKey?: string; nameKey?: string }) {
  const h = height ?? Math.max(120, data.length * 34 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#eceef6" horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...axis} unit={unit} />
        <YAxis type="category" dataKey={nameKey} width={130} {...axis} tick={{ fill: '#4b5680', fontSize: 11.5 }} />
        <Tooltip content={<TooltipBox unit={unit} />} cursor={{ fill: '#f0edfe' }} />
        <Bar dataKey={valueKey} name={valueKey === 'value' ? 'Value' : valueKey} fill={color} radius={[0, 6, 6, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
