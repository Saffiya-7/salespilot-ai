import { motion } from 'framer-motion';
import { AlertTriangle, Info, KeyRound, Loader2, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '../../lib/api';
import { cn } from '../../utils/format';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 text-sm text-ink-500', className)} role="status">
      <Loader2 className="size-5 animate-spin text-brand-500" aria-hidden />
      {label && <span>{label}</span>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-linear-to-br from-brand-50 to-lavender-200 text-brand-600 ring-1 ring-brand-100">
          {icon}
        </div>
      )}
      <h3 className={cn('font-semibold text-ink-900', compact ? 'text-sm' : 'text-base')}>{title}</h3>
      {description && <p className={cn('mt-1.5 max-w-md text-ink-500', compact ? 'text-xs' : 'text-sm')}>{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: 'info' | 'warning' | 'error' | 'ai';
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const styles = {
    info: 'bg-sky-50 border-sky-200 text-sky-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-rose-50 border-rose-200 text-rose-900',
    ai: 'bg-brand-50/70 border-brand-200 text-brand-900',
  }[tone];
  const icon = {
    info: <Info className="size-4" />,
    warning: <AlertTriangle className="size-4" />,
    error: <AlertTriangle className="size-4" />,
    ai: <Sparkles className="size-4" />,
  }[tone];
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', styles, className)} role={tone === 'error' ? 'alert' : undefined}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cn('leading-relaxed opacity-90', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** Shows an error from an AI/API call; configuration problems get setup guidance. */
export function ErrorNotice({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const e = error instanceof Error ? error : new Error(String(error));
  if (e instanceof ApiError && (e.isConfigError || e.code === 'FUNCTIONS_UNAVAILABLE')) {
    return (
      <Alert tone="warning" title={e.code === 'AI_NOT_CONFIGURED' ? 'AI is not configured yet' : 'Server setup needed'} className={className}>
        <span className="flex items-start gap-1.5">
          <KeyRound className="mt-0.5 size-3.5 shrink-0" />
          <span>{e.message}</span>
        </span>
      </Alert>
    );
  }
  return (
    <Alert tone="error" title="Something went wrong" className={className}>
      {e.message}
    </Alert>
  );
}

/** Animated "AI is thinking" placeholder used while a function runs. */
export function AiThinking({ label = 'Analysing…', lines = 4 }: { label?: string; lines?: number }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
        <motion.span
          className="grid size-7 place-items-center rounded-lg bg-brand-100"
          animate={{ rotate: [0, 12, -12, 0] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
        >
          <Sparkles className="size-4" />
        </motion.span>
        {label}
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3.5', ['w-full', 'w-11/12', 'w-4/5', 'w-2/3', 'w-3/4'][i % 5])} />
      ))}
    </div>
  );
}

export function AiLabel({ children = 'AI-generated', className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-brand-700 uppercase', className)}>
      <Sparkles className="size-3" />
      {children}
    </span>
  );
}
