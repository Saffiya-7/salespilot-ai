import { ChevronDown } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../utils/format';

interface FieldShellProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  id: string;
  className?: string;
  children: ReactNode;
}

function FieldShell({ label, hint, error, required, id, className, children }: FieldShellProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Common = { label?: ReactNode; hint?: ReactNode; error?: string; wrapperClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Common>(function Input(
  { label, hint, error, wrapperClassName, className, id, required, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} id={fid} className={wrapperClassName}>
      <input
        ref={ref}
        id={fid}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        className={cn('input', error && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100', className)}
        {...rest}
      />
    </FieldShell>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Common>(function Textarea(
  { label, hint, error, wrapperClassName, className, id, required, rows = 3, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} id={fid} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={fid}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn('input resize-y leading-relaxed', error && 'border-rose-300', className)}
        {...rest}
      />
    </FieldShell>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & Common & { options: readonly (string | { value: string; label: string })[]; placeholder?: string }
>(function Select({ label, hint, error, wrapperClassName, className, id, required, options, placeholder, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} id={fid} className={wrapperClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={fid}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn('input appearance-none pr-9', className)}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const v = typeof o === 'string' ? o : o.value;
            const l = typeof o === 'string' ? o : o.label;
            return (
              <option key={v} value={v}>
                {l}
              </option>
            );
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
      </div>
    </FieldShell>
  );
});
