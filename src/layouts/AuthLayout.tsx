import { motion } from 'framer-motion';
import { BadgeCheck, Bot, Gauge, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '../components/Logo';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full max-w-sm">
            <h1 className="text-[28px] font-bold">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-ink-500">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-center text-sm text-ink-500">{footer}</div>}
          </motion.div>
        </div>
        <p className="text-xs text-ink-400">Protected by Supabase Auth · Your data is private to your account.</p>
      </div>
      <div className="relative hidden overflow-hidden bg-linear-to-br from-brand-700 via-brand-800 to-ink-950 lg:block">
        <div className="bg-grid absolute inset-0 opacity-25" />
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-400/30 blur-3xl" />
        <div className="relative flex h-full flex-col justify-center px-14 py-16 text-white">
          <h2 className="max-w-md text-4xl leading-tight font-bold text-white">Find Better Leads. Sell Smarter. Close Faster.</h2>
          <p className="mt-4 max-w-md text-brand-100">An AI co-pilot that researches prospects, scores leads and drafts outreach — grounded in your own pipeline data.</p>
          <div className="mt-10 grid max-w-md gap-3">
            {[
              { icon: <Gauge className="size-4" />, t: 'AI lead scoring with transparent reasoning' },
              { icon: <Mail className="size-4" />, t: 'Personalised e-mails in five tones' },
              { icon: <BadgeCheck className="size-4" />, t: 'Verified facts kept separate from AI guesses' },
              { icon: <Bot className="size-4" />, t: 'An assistant that reads your real data' },
            ].map((x, i) => (
              <motion.div
                key={x.t}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm backdrop-blur"
              >
                <span className="grid size-7 place-items-center rounded-lg bg-white/15">{x.icon}</span>
                {x.t}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
