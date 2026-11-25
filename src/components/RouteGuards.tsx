import { Database, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured, supabaseConfigProblem } from '../lib/supabase';
import { Spinner } from './ui/Feedback';
import { Logo } from './Logo';

export function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-lavender-50">
      <Spinner label="Loading SalesPilot…" />
    </div>
  );
}

/** Shown instead of the app when Supabase keys are missing, so a fresh clone explains itself. */
export function SetupRequired() {
  return (
    <div className="min-h-screen bg-lavender-50 bg-grid">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Logo />
        <div className="card mt-8 p-8">
          <div className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Database className="size-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Connect your Supabase project</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            SalesPilot stores your leads in your own Supabase database. {supabaseConfigProblem}
          </p>
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-700">
            <li>Create a free project at supabase.com.</li>
            <li>Run the SQL file in <code className="rounded bg-ink-100 px-1">supabase/migrations/</code> in the Supabase SQL editor.</li>
            <li>
              Copy <code className="rounded bg-ink-100 px-1">.env.example</code> to <code className="rounded bg-ink-100 px-1">.env</code> and fill in{' '}
              <code className="rounded bg-ink-100 px-1">VITE_SUPABASE_URL</code> and <code className="rounded bg-ink-100 px-1">VITE_SUPABASE_ANON_KEY</code> (Project Settings → API).
            </li>
            <li>Restart the dev server. On Netlify, add the same variables under Site configuration → Environment variables and redeploy.</li>
          </ol>
          <p className="mt-5 text-xs text-ink-500">Only the public anon/publishable key goes here. Never use the service-role or secret key in the browser.</p>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
            Open Supabase dashboard <ExternalLink className="size-3.5" />
          </a>
        </div>
        <p className="mt-6 text-center text-sm text-ink-500">
          <Link to="/" className="font-medium text-brand-700 hover:underline">
            ← Back to the homepage
          </Link>
        </p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (!isSupabaseConfigured) return <SetupRequired />;
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading, recovering } = useAuth();
  if (!isSupabaseConfigured) return <SetupRequired />;
  if (loading) return <FullPageSpinner />;
  if (user && !recovering) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
