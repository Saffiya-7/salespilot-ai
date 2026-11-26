import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  CalendarClock,
  Check,
  FileSpreadsheet,
  Flame,
  Gauge,
  KanbanSquare,
  Lightbulb,
  Lock,
  Mail,
  Menu,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo, LogoMark } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../utils/format';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

const FEATURES: { icon: ReactNode; title: string; text: string; tint: string }[] = [
  { icon: <Search className="size-5" />, title: 'AI Lead Research', text: 'Turn a company name and a few notes into an overview, likely challenges, needs and a sharp outreach angle — with verified facts kept apart from AI hypotheses.', tint: 'from-brand-500 to-violet-500' },
  { icon: <Gauge className="size-5" />, title: 'AI Lead Scoring', text: 'A 0–100 priority estimate across seven factors — industry, size, budget, decision-maker, fit, requirements and engagement — with the reasoning shown.', tint: 'from-rose-400 to-orange-500' },
  { icon: <Mail className="size-5" />, title: 'Cold Email Generator', text: 'Personalised e-mails in five tones. Generate three alternatives, rewrite, shorten or sharpen personalisation — without inventing facts about your prospect.', tint: 'from-sky-400 to-indigo-500' },
  { icon: <CalendarClock className="size-5" />, title: 'Follow-up Automation', text: 'Track last contact and next steps, flag overdue follow-ups, draft context-aware messages and get timing recommendations. You stay in control of every send.', tint: 'from-emerald-400 to-teal-500' },
  { icon: <KanbanSquare className="size-5" />, title: 'Visual Sales Pipeline', text: 'Drag leads across eight stages from New Lead to Won. Search, filter by industry, score and stage, and open any lead for its full activity history.', tint: 'from-amber-400 to-orange-500' },
  { icon: <Bot className="size-5" />, title: 'AI Sales Assistant', text: 'Ask “which leads should I prioritise today?” — the assistant queries your actual pipeline before it answers, and never makes up numbers.', tint: 'from-violet-500 to-fuchsia-500' },
];

const AUDIENCES = [
  { icon: <Rocket className="size-4" />, label: 'Startups' },
  { icon: <Briefcase className="size-4" />, label: 'Agencies' },
  { icon: <Building2 className="size-4" />, label: 'B2B sales teams' },
  { icon: <Lightbulb className="size-4" />, label: 'Founders' },
  { icon: <Target className="size-4" />, label: 'BD professionals' },
];

function Nav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const links = [
    { href: '#features', label: 'Features' },
    { href: '#how', label: 'How it works' },
    { href: '#trust', label: 'Responsible AI' },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100/60 bg-white/75 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-ink-600 transition hover:text-ink-950">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link to="/app" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-glow hover:bg-brand-700">
              Open dashboard <ArrowRight className="size-4" />
            </Link>
          ) : (
            <>
              <Link to="/login" className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-ink-700 hover:bg-lavender-100">
                Sign in
              </Link>
              <Link to="/signup" className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-950 px-4 text-sm font-semibold text-white hover:bg-ink-800">
                Start free <ArrowRight className="size-4" />
              </Link>
            </>
          )}
        </div>
        <button className="rounded-lg p-2 text-ink-700 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-ink-100 bg-white px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-lavender-50">
                {l.label}
              </a>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link to={user ? '/app' : '/login'} className="rounded-xl border border-ink-200 py-2.5 text-center text-sm font-semibold text-ink-800">
                {user ? 'Dashboard' : 'Sign in'}
              </Link>
              <Link to="/signup" className="rounded-xl bg-brand-600 py-2.5 text-center text-sm font-semibold text-white">
                Start free
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/** Illustrative product preview. Values are labelled as an example — not usage claims. */
function HeroPreview() {
  const stages = [
    { name: 'Interested', color: 'bg-violet-500', cards: [{ n: 'Northwind Labs', s: 82, l: 'Hot' }, { n: 'Kite & Co', s: 61, l: 'Warm' }] },
    { name: 'Meeting', color: 'bg-brand-500', cards: [{ n: 'Brightpath Health', s: 77, l: 'Hot' }] },
    { name: 'Proposal', color: 'bg-amber-500', cards: [{ n: 'Orbit Logistics', s: 58, l: 'Warm' }] },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[32px] bg-linear-to-br from-brand-200/60 via-lavender-200/40 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-pop ring-1 ring-ink-100 backdrop-blur">
        <div className="flex items-center gap-1.5 border-b border-ink-100 bg-lavender-25 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-rose-300" />
          <span className="size-2.5 rounded-full bg-amber-300" />
          <span className="size-2.5 rounded-full bg-emerald-300" />
          <span className="ml-3 rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-ink-400 ring-1 ring-ink-100">Example workspace</span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[1.1fr_1fr] sm:p-5">
          <div className="space-y-3">
            <div className="rounded-xl border border-ink-100 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-8 place-items-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">NL</div>
                  <div>
                    <div className="text-[13px] font-semibold text-ink-900">Northwind Labs</div>
                    <div className="text-[11px] text-ink-500">Head of Operations · SaaS</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                  <Flame className="size-3" /> 82
                </span>
              </div>
              <div className="mt-3 space-y-1.5">
                {[['Product fit', 9], ['Budget indicators', 7], ['Decision-maker', 8]].map(([k, v]) => (
                  <div key={k as string} className="flex items-center gap-2 text-[11px] text-ink-500">
                    <span className="w-28 shrink-0">{k}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-ink-100">
                      <motion.div className="h-full rounded-full bg-linear-to-r from-brand-400 to-brand-600" initial={{ width: 0 }} animate={{ width: `${(v as number) * 10}%` }} transition={{ delay: 0.6, duration: 0.9 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-brand-50 px-2.5 py-2 text-[11px] leading-relaxed text-brand-800">
                <span className="font-semibold">Next action:</span> Book a 20-min ops workflow review before quarter end.
              </div>
            </div>
            <div className="rounded-xl border border-ink-100 p-3.5">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-800">
                <Mail className="size-3.5 text-brand-600" /> Draft · Professional tone
              </div>
              <div className="mt-2 text-[11.5px] leading-relaxed text-ink-600">
                <span className="font-medium text-ink-800">Subject:</span> Cutting manual hand-offs at Northwind
                <br />
                Hi Priya — you mentioned onboarding takes your ops team two weeks per client…
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stages.map((st) => (
              <div key={st.name} className="rounded-xl bg-lavender-50 p-2">
                <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-600">
                  <span className={cn('size-1.5 rounded-full', st.color)} />
                  {st.name}
                </div>
                <div className="space-y-1.5">
                  {st.cards.map((c, i) => (
                    <motion.div
                      key={c.n}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.15 }}
                      className="rounded-lg bg-white p-2 shadow-card ring-1 ring-ink-100"
                    >
                      <div className="truncate text-[10.5px] font-semibold text-ink-800">{c.n}</div>
                      <div className={cn('mt-1 inline-block rounded px-1 text-[9.5px] font-semibold', c.l === 'Hot' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700')}>
                        {c.l} · {c.s}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.9 }}
        className="absolute -bottom-6 -left-4 hidden w-64 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-pop sm:block"
      >
        <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-900">
          <span className="grid size-6 place-items-center rounded-md bg-brand-600 text-white">
            <Bot className="size-3.5" />
          </span>
          Sales Assistant
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-600">“Start with Northwind and Brightpath — both are Hot and their follow-ups are due today.”</p>
      </motion.div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-ink-900">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="absolute top-[-200px] left-1/2 -z-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pt-16 pb-24 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:pt-24 lg:pb-32">
          <div>
            <motion.div {...fadeUp} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">
              <Sparkles className="size-3.5" /> AI sales intelligence for B2B teams
            </motion.div>
            <motion.h1 {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }} className="mt-6 text-[40px] leading-[1.05] font-extrabold sm:text-6xl">
              Find Better Leads.
              <br />
              <span className="text-gradient">Sell Smarter.</span>
              <br />
              Close Faster.
            </motion.h1>
            <motion.p {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
              Sumo researches your prospects, scores every lead, writes personalised outreach and keeps your follow-ups on track — so your team spends its time on the deals most likely to close.
            </motion.p>
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }} className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 text-[15px] font-semibold text-white shadow-glow transition hover:bg-brand-700">
                Create your free workspace <ArrowRight className="size-4" />
              </Link>
              <a href="#features" className="inline-flex h-12 items-center rounded-xl border border-ink-200 bg-white px-6 text-[15px] font-semibold text-ink-800 transition hover:border-ink-300">
                See what it does
              </a>
            </motion.div>
            <motion.ul {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-500">
              {['Your data stays in your own database', 'AI never sends e-mail on its own', 'CSV import in minutes'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-500" /> {t}
                </li>
              ))}
            </motion.ul>
          </div>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}>
            <HeroPreview />
          </motion.div>
        </div>
      </section>

      {/* Audience strip */}
      <section className="border-y border-ink-100 bg-lavender-25">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-5 py-8 sm:flex-row sm:justify-between sm:px-8">
          <p className="text-sm font-medium text-ink-500">Built for teams that sell to businesses</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {AUDIENCES.map((a) => (
              <span key={a.label} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-ink-700 ring-1 ring-ink-100">
                <span className="text-brand-600">{a.icon}</span>
                {a.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <div className="text-sm font-semibold tracking-wider text-brand-600 uppercase">One workspace, the whole sales motion</div>
            <h2 className="mt-3 text-3xl font-bold sm:text-[40px] sm:leading-tight">More than a chatbot — an AI co-pilot for every step of the deal</h2>
            <p className="mt-4 text-lg text-ink-600">From the first bit of research to the signed proposal, each tool works on the leads in your pipeline.</p>
          </motion.div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.05 }}
                className="group relative rounded-2xl border border-ink-100 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop"
              >
                <div className={cn('grid size-11 place-items-center rounded-xl bg-linear-to-br text-white shadow-sm', f.tint)}>{f.icon}</div>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{f.text}</p>
              </motion.div>
            ))}
          </div>
          <motion.div {...fadeUp} className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="flex items-start gap-4 rounded-2xl border border-ink-100 bg-lavender-25 p-6">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-ink-100">
                <BarChart3 className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">Analytics that reflect reality</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-600">Conversion, pipeline performance, lead sources, industries and follow-up completion — computed from your stored data, exportable as CSV and PDF.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-2xl border border-ink-100 bg-lavender-25 p-6">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-ink-100">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">Bring your leads with you</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-600">Upload a CSV, map columns, preview, validate required fields and skip duplicates automatically. Export any filtered list back out.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 bg-ink-950 py-24 text-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <motion.div {...fadeUp} className="max-w-2xl">
            <div className="text-sm font-semibold tracking-wider text-brand-300 uppercase">How it works</div>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-[40px] sm:leading-tight">From a list of names to a prioritised pipeline</h2>
          </motion.div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { n: '01', icon: <Users className="size-5" />, t: 'Add or import leads', d: 'Add leads by hand or import a CSV. Tell Sumo what you sell and who you sell to once, in Settings.' },
              { n: '02', icon: <Sparkles className="size-5" />, t: 'Let AI do the groundwork', d: 'Research each company, get a scored priority with reasons, and generate tailored first e-mails and follow-ups.' },
              { n: '03', icon: <Target className="size-5" />, t: 'Work the pipeline', d: 'Move deals through stages, never miss a follow-up, and ask the assistant where to focus next.' },
            ].map((s, i) => (
              <motion.div key={s.n} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }} className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
                <div className="flex items-center justify-between">
                  <div className="grid size-10 place-items-center rounded-xl bg-brand-500/20 text-brand-200">{s.icon}</div>
                  <span className="font-display text-sm font-bold text-white/30">{s.n}</span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">{s.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/65">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="scroll-mt-20 py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <motion.div {...fadeUp}>
            <div className="text-sm font-semibold tracking-wider text-brand-600 uppercase">Responsible by design</div>
            <h2 className="mt-3 text-3xl font-bold sm:text-[40px] sm:leading-tight">AI you can actually trust in front of a customer</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-600">Sales runs on credibility. Sumo is explicit about what it knows, what it is guessing, and what it will never do without you.</p>
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: <BadgeCheck className="size-5" />, t: 'Verified vs. hypothesis', d: 'Research separates facts you provided or that live search found from AI assumptions.' },
              { icon: <Gauge className="size-5" />, t: 'Scores are estimates', d: 'Lead scores are labelled as AI estimates of fit — not conversion probabilities.' },
              { icon: <Mail className="size-5" />, t: 'No invented details', d: 'E-mails only personalise with facts you gave; nothing is made up about your prospect.' },
              { icon: <ShieldCheck className="size-5" />, t: 'You press send', d: 'Nothing is ever e-mailed automatically. Copy, export or open drafts in your own mail app.' },
              { icon: <Lock className="size-5" />, t: 'Private by default', d: 'Row-level security means every record is visible only to the account that created it.' },
              { icon: <Bot className="size-5" />, t: 'Grounded answers', d: 'The assistant reads your real pipeline before answering and never fabricates metrics.' },
            ].map((c, i) => (
              <motion.div key={c.t} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.04 }} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
                <div className="text-brand-600">{c.icon}</div>
                <h3 className="mt-3 font-semibold">{c.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{c.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24 sm:px-8">
        <motion.div
          {...fadeUp}
          className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-linear-to-br from-brand-600 via-brand-700 to-ink-950 px-8 py-16 text-center text-white shadow-pop sm:px-16"
        >
          <div className="bg-grid absolute inset-0 opacity-30" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Your next best deal is already in your list.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-brand-100">Set up your workspace, import your leads and let Sumo show you where to focus.</p>
            <Link to="/signup" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-brand-700 transition hover:bg-brand-50">
              Get started free <ArrowRight className="size-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-ink-100 bg-lavender-25">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-ink-500 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2">
            <LogoMark className="size-6" />
            <span className="font-semibold text-ink-700">Sumo</span>
            <span>· Find Better Leads. Sell Smarter. Close Faster.</span>
          </div>
          <div className="flex gap-5">
            <Link to="/login" className="hover:text-ink-900">Sign in</Link>
            <Link to="/signup" className="hover:text-ink-900">Create account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
