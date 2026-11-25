import { useId } from 'react';
import { Link } from 'react-router';
import { cn } from '../utils/format';

export function LogoMark({ className }: { className?: string }) {
  // unique id: several logos can be on the page, some inside hidden containers
  const gid = `sp-logo-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b78fa" />
          <stop offset="1" stopColor="#4c34c4" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gid})`} />
      <path d="M18 40.5 31 15l4.6 14.2L46 25.8 33 51l-4.6-14.2z" fill="#fff" />
    </svg>
  );
}

export function Logo({ to = '/', className, light }: { to?: string; className?: string; light?: boolean }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5', className)} aria-label="SalesPilot AI home">
      <LogoMark />
      <span className={cn('font-display text-[17px] font-bold tracking-tight', light ? 'text-white' : 'text-ink-950')}>
        SalesPilot<span className="text-brand-600"> AI</span>
      </span>
    </Link>
  );
}
