import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '../../utils/format';

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"
    >
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-semibold tracking-wider text-brand-600 uppercase">{eyebrow}</div>}
        <h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 xl:shrink-0">{actions}</div>}
    </motion.div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('inline-flex max-w-full overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-ink-100', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition',
            value === o.value ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {value === o.value && (
            <motion.span layoutId={`tab-${options.map((x) => x.value).join('')}`} className="absolute inset-0 rounded-lg bg-brand-50 ring-1 ring-brand-100" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
          )}
          <span className="relative">{o.label}</span>
          {o.count !== undefined && (
            <span className={cn('relative rounded-full px-1.5 text-[11px] tabular-nums', value === o.value ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500')}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = 'brand',
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  accent?: 'brand' | 'green' | 'amber' | 'red' | 'blue' | 'violet';
  delay?: number;
}) {
  const accents = {
    brand: 'from-brand-500 to-brand-700',
    green: 'from-emerald-400 to-emerald-600',
    amber: 'from-amber-400 to-orange-500',
    red: 'from-rose-400 to-rose-600',
    blue: 'from-sky-400 to-blue-600',
    violet: 'from-violet-400 to-fuchsia-600',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="card group relative overflow-hidden p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-ink-500">{label}</div>
          <div className="mt-2 font-display text-[26px] leading-none font-bold text-ink-950 tabular-nums">{value}</div>
        </div>
        <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br text-white shadow-sm', accents[accent])}>{icon}</div>
      </div>
      {hint && <div className="mt-3 text-xs text-ink-500">{hint}</div>}
    </motion.div>
  );
}
