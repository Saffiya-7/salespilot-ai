import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Bot,
  CalendarClock,
  ChevronDown,
  Gauge,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { followupStats } from '../../shared/metrics';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { useFollowups, useProfile } from '../hooks/useData';
import { cn, initials } from '../utils/format';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  end?: boolean;
}

function useNav(): { title: string; items: NavItem[] }[] {
  const { data: followups } = useFollowups();
  const due = useMemo(() => {
    if (!followups) return 0;
    const s = followupStats(followups);
    return s.overdue + s.dueToday;
  }, [followups]);
  return [
    {
      title: 'Overview',
      items: [{ to: '/app', label: 'Dashboard', icon: <LayoutDashboard className="size-[18px]" />, end: true }],
    },
    {
      title: 'Pipeline',
      items: [
        { to: '/app/leads', label: 'Lead Management', icon: <Users className="size-[18px]" /> },
        { to: '/app/pipeline', label: 'Sales Pipeline', icon: <KanbanSquare className="size-[18px]" /> },
        { to: '/app/followups', label: 'Follow-ups', icon: <CalendarClock className="size-[18px]" />, badge: due },
      ],
    },
    {
      title: 'AI Tools',
      items: [
        { to: '/app/research', label: 'Lead Research', icon: <Search className="size-[18px]" /> },
        { to: '/app/scoring', label: 'Lead Scoring', icon: <Gauge className="size-[18px]" /> },
        { to: '/app/emails', label: 'Email Generator', icon: <Mail className="size-[18px]" /> },
        { to: '/app/assistant', label: 'Sales Assistant', icon: <Bot className="size-[18px]" /> },
      ],
    },
    {
      title: 'Insights',
      items: [
        { to: '/app/analytics', label: 'Sales Analytics', icon: <BarChart3 className="size-[18px]" /> },
        { to: '/app/settings', label: 'Settings', icon: <Settings className="size-[18px]" /> },
      ],
    },
  ];
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const groups = useNav();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo to="/app" />
      </div>
      <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-ink-400 uppercase">{g.title}</div>
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition',
                        isActive ? 'bg-white text-brand-700 shadow-card ring-1 ring-ink-100' : 'text-ink-600 hover:bg-white/70 hover:text-ink-900',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <motion.span layoutId="nav-active" className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-brand-500" />}
                        <span className={cn(isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600')}>{item.icon}</span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {!!item.badge && (
                          <span className="rounded-full bg-rose-500 px-1.5 py-px text-[11px] font-semibold text-white tabular-nums">{item.badge}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 hidden rounded-2xl bg-linear-to-br from-brand-600 to-brand-800 p-4 text-white shadow-glow [@media(min-height:780px)]:block">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="size-4" /> Ask your AI co-pilot
        </div>
        <p className="mt-1 text-xs leading-relaxed text-brand-100">Which leads to prioritise today? Ask the Sales Assistant — it reads your real data.</p>
        <NavLink to="/app/assistant" onClick={onNavigate} className="mt-3 inline-block rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-white/25">
          Open assistant →
        </NavLink>
      </div>
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const name = profile?.full_name || user?.email?.split('@')[0] || 'Account';
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 transition hover:bg-white"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid size-8 place-items-center rounded-lg bg-linear-to-br from-brand-400 to-brand-700 text-xs font-bold text-white">{initials(name)}</span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[160px] truncate text-[13px] leading-tight font-semibold text-ink-900">{name}</span>
          <span className="block max-w-[160px] truncate text-[11px] leading-tight text-ink-500">{profile?.company_name || user?.email}</span>
        </span>
        <ChevronDown className="size-4 text-ink-400" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-ink-100 bg-white p-1.5 shadow-pop"
            role="menu"
          >
            <div className="border-b border-ink-100 px-3 py-2 text-xs text-ink-500">{user?.email}</div>
            <button role="menuitem" onClick={() => { setOpen(false); navigate('/app/settings'); }} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-lavender-50">
              <Settings className="size-4" /> Settings
            </button>
            <button
              role="menuitem"
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-lavender-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-ink-100/80 bg-lavender-100/60 backdrop-blur lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-ink-950/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="absolute inset-y-0 left-0 w-72 bg-lavender-50 shadow-pop"
            >
              <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-3 rounded-lg p-2 text-ink-500 hover:bg-white" aria-label="Close menu">
                <X className="size-5" />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-100/70 bg-lavender-50/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-ink-600 hover:bg-white lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo to="/app" />
          </div>
          <div className="flex-1" />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
