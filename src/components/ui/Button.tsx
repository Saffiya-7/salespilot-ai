import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle' | 'dark';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_6px_16px_-6px_rgb(93_67_227/0.6)] hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary: 'bg-white text-ink-800 border border-ink-200 shadow-sm hover:bg-lavender-50 hover:border-ink-300 disabled:text-ink-400',
  ghost: 'text-ink-600 hover:bg-lavender-100 hover:text-ink-900 disabled:text-ink-300',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm disabled:bg-rose-300',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:text-brand-300',
  dark: 'bg-ink-950 text-white hover:bg-ink-800 disabled:bg-ink-400',
};

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-lg',
  sm: 'h-8.5 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-150 select-none disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});
