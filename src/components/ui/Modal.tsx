import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/format';
import { Button } from './Button';

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEscape(open, onClose);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => panel.current?.querySelector<HTMLElement>('input,textarea,select,button:not([data-close])')?.focus(), 50);
  }, [open]);
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cn('relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl', widths[size])}
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" data-close className="-mr-2 px-2">
                <X className="size-4" />
              </Button>
            </div>
            <div className="scrollbar-thin overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 bg-lavender-25 px-6 py-3.5 sm:rounded-b-2xl">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  useEscape(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-ink-950/30 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-lavender-25 shadow-pop"
          >
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-white px-5 py-3.5">
              <div className="min-w-0 flex-1">{title}</div>
              <div className="flex items-center gap-1.5">
                {actions}
                <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" className="px-2">
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-600">{message}</div>
    </Modal>
  );
}
