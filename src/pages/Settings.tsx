import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, Building2, CheckCircle2, Download, Globe, KeyRound, Lock, LogOut, Mail, Package, ShieldCheck, User, XCircle } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { EMAIL_TONES, type EmailTone } from '../../shared/constants';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Alert, ErrorNotice, Skeleton } from '../components/ui/Feedback';
import { Input, Select, Textarea } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { useLeads, useProfile, useRefresh } from '../hooks/useData';
import { leadsToCsv } from '../lib/csv';
import { getAiStatus } from '../services/ai';
import { upsertProfile } from '../services/profile';
import { dateStamp, downloadText } from '../utils/download';
import { passwordProblem } from '../utils/validation';

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-lavender-25 p-3 ring-1 ring-ink-100">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-ink-300" />}
      <div className="min-w-0 text-[13px]">
        <div className="font-semibold text-ink-900">{label}</div>
        <div className="text-ink-500">{detail}</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, signOut, updatePassword } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { data: leads = [] } = useLeads();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const status = useQuery({ queryKey: ['ai-status'], queryFn: getAiStatus, retry: false, staleTime: 60_000 });
  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    job_title: '',
    product_name: '',
    product_description: '',
    target_customer: '',
    value_proposition: '',
    default_tone: 'Professional' as EmailTone,
  });
  const [pw, setPw] = useState({ next: '', confirm: '' });

  useEffect(() => {
    if (profile)
      setForm({
        full_name: profile.full_name ?? '',
        company_name: profile.company_name ?? '',
        job_title: profile.job_title ?? '',
        product_name: profile.product_name ?? '',
        product_description: profile.product_description ?? '',
        target_customer: profile.target_customer ?? '',
        value_proposition: profile.value_proposition ?? '',
        default_tone: profile.default_tone ?? 'Professional',
      });
  }, [profile]);

  const save = useMutation({
    mutationFn: () => {
      const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]));
      return upsertProfile(user!.id, { ...clean, default_tone: form.default_tone, onboarding_completed: true });
    },
    onSuccess: async () => {
      toast.success('Settings saved');
      await refresh('profile');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const changePw = useMutation({
    mutationFn: async () => {
      const p = passwordProblem(pw.next);
      if (p) throw new Error(p);
      if (pw.next !== pw.confirm) throw new Error('Passwords do not match.');
      await updatePassword(pw.next);
    },
    onSuccess: () => {
      setPw({ next: '', confirm: '' });
      toast.success('Password updated');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <div>
      <PageHeader eyebrow="Workspace" title="Settings" description="Your profile, what you sell (used by every AI feature), AI configuration and account security." />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <form onSubmit={submit} className="space-y-6">
          <Card>
            <CardHeader icon={<User className="size-4" />} title="Profile" />
            <CardBody>
              {isLoading ? (
                <Skeleton className="h-24" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Full name" value={form.full_name} onChange={set('full_name')} maxLength={120} />
                  <Input label="E-mail" value={user?.email ?? ''} disabled hint="Your sign-in e-mail" />
                  <Input label="Company" value={form.company_name} onChange={set('company_name')} maxLength={160} />
                  <Input label="Job title" value={form.job_title} onChange={set('job_title')} maxLength={120} />
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Package className="size-4" />} title="What you sell" description="The AI uses this to judge lead fit, research prospects and write outreach. Be specific." />
            <CardBody className="space-y-4">
              <Input label="Product or service name" value={form.product_name} onChange={set('product_name')} placeholder="e.g. FlowDesk" maxLength={160} />
              <Textarea label="What it does" rows={3} value={form.product_description} onChange={set('product_description')} placeholder="e.g. A no-code platform that automates client onboarding for B2B service teams." maxLength={2000} />
              <Textarea label="Ideal customer profile" rows={2} value={form.target_customer} onChange={set('target_customer')} placeholder="e.g. Operations leaders at 50–500 person agencies and SaaS companies in India and the UK" maxLength={1000} />
              <Textarea label="Core value proposition" rows={2} value={form.value_proposition} onChange={set('value_proposition')} placeholder="e.g. Cut onboarding time in half without hiring" maxLength={1000} />
              <Select label="Default e-mail tone" value={form.default_tone} onChange={set('default_tone')} options={EMAIL_TONES} wrapperClassName="sm:w-64" />
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={save.isPending}>Save settings</Button>
          </div>
        </form>

        <div className="space-y-6">
          <Card>
            <CardHeader icon={<Bot className="size-4" />} title="AI configuration" description="Server-side settings (environment variables)" />
            <CardBody className="space-y-2.5">
              {status.isLoading ? (
                <Skeleton className="h-32" />
              ) : status.error ? (
                <ErrorNotice error={status.error} />
              ) : status.data ? (
                <>
                  <StatusRow ok={status.data.gemini_configured} label="Google Gemini" detail={status.data.gemini_configured ? <>Connected · model <code className="text-ink-700">{status.data.model}</code></> : 'GEMINI_API_KEY is not set — AI features are disabled.'} />
                  <StatusRow
                    ok={status.data.live_search.configured}
                    label="Live web search (optional)"
                    detail={status.data.live_search.configured ? `Provider: ${status.data.live_search.provider}` : 'Not configured — AI research uses only the information you provide.'}
                  />
                  <StatusRow ok={false} label="E-mail sending" detail="Not configured. SalesPilot never sends e-mail automatically — you copy drafts or open them in your own mail app." />
                  <div className="flex items-center gap-2 pt-1 text-xs text-ink-500">
                    <ShieldCheck className="size-3.5" /> Rate limit: {status.data.limits.perMinute}/min · {status.data.limits.perDay}/day per user
                  </div>
                </>
              ) : null}
              <p className="pt-1 text-[11.5px] leading-relaxed text-ink-400">API keys live only on the server (Netlify environment variables) and are never shown here or sent to your browser.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Lock className="size-4" />} title="Change password" />
            <CardBody>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  changePw.mutate();
                }}
              >
                <Input type="password" label="New password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
                <Input type="password" label="Confirm new password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
                <Button type="submit" variant="secondary" icon={<KeyRound className="size-4" />} loading={changePw.isPending} disabled={!pw.next}>Update password</Button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Building2 className="size-4" />} title="Your data" />
            <CardBody className="space-y-3">
              <Alert tone="info">Your records are protected by Row Level Security — only your account can read or change them.</Alert>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={<Download className="size-4" />} disabled={!leads.length} onClick={() => downloadText(`salespilot-all-leads-${dateStamp()}.csv`, leadsToCsv(leads), 'text/csv;charset=utf-8')}>
                  Export all leads ({leads.length})
                </Button>
                <Button
                  variant="ghost"
                  icon={<LogOut className="size-4" />}
                  className="text-rose-600 hover:bg-rose-50"
                  onClick={async () => {
                    await signOut();
                    navigate('/login');
                  }}
                >
                  Sign out
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge tone="slate" icon={<Mail className="size-3" />}>{user?.email}</Badge>
                <Badge tone="slate" icon={<Globe className="size-3" />}>Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</Badge>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
