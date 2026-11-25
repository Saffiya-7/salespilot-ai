import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Building2,
  Compass,
  ExternalLink,
  Globe,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Megaphone,
  Search,
  Sparkles,
  Target,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { COMMON_INDUSTRIES } from '../../shared/constants';
import { formatZodError, researchRequestSchema } from '../../shared/schemas';
import type { ResearchResult } from '../../shared/types';
import { LeadPicker } from '../components/leads/LeadPicker';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { AiLabel, AiThinking, Alert, EmptyState, ErrorNotice } from '../components/ui/Feedback';
import { Input, Textarea } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { useLeads, useProfile, useRefresh } from '../hooks/useData';
import { getAiStatus, researchCompany } from '../services/ai';
import { useQuery } from '@tanstack/react-query';
import { formatRelative } from '../utils/format';

function ListBlock({ icon, title, items, tone = 'brand' }: { icon: ReactNode; title: string; items: string[]; tone?: 'brand' | 'amber' | 'sky' }) {
  if (!items.length) return null;
  const dot = { brand: 'bg-brand-500', amber: 'bg-amber-500', sky: 'bg-sky-500' }[tone];
  return (
    <Card>
      <CardHeader icon={icon} title={title} />
      <CardBody>
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-700">
              <span className={`mt-2 size-1.5 shrink-0 rounded-full ${dot}`} />
              {it}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function TextBlock({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <Card>
      <CardHeader icon={icon} title={title} />
      <CardBody>
        <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-ink-700">{text}</p>
      </CardBody>
    </Card>
  );
}

export function ResearchView({ research }: { research: ResearchResult }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Alert
        tone={research.mode === 'live_search' ? 'info' : 'ai'}
        title={research.mode === 'live_search' ? 'Researched with live web search' : 'Analysed from the information you provided'}
      >
        {research.mode === 'live_search'
          ? 'Facts marked "Web" come from the linked search results. Everything else is AI analysis — verify before relying on it.'
          : 'No web search was performed. Only details you typed are treated as facts; everything else is an AI hypothesis based on general industry knowledge.'}
        <span className="mt-1 block text-xs opacity-75">Generated {formatRelative(research.generated_at)} · {research.model}</span>
      </Alert>

      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-brand-600 to-brand-800 p-5 text-white sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="violet" className="bg-white/15 text-white ring-white/20">{research.industry_classification.primary}</Badge>
            {research.industry_classification.sub_industry && <Badge tone="violet" className="bg-white/10 text-white ring-white/15">{research.industry_classification.sub_industry}</Badge>}
            <span className="text-xs text-brand-100">Classification confidence: {research.industry_classification.confidence}</span>
          </div>
          <h3 className="mt-3 text-sm font-semibold tracking-wide text-brand-100 uppercase">Company overview</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-white">{research.company_overview}</p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-emerald-100">
          <CardHeader icon={<BadgeCheck className="size-4" />} title="Verified information" description="Only from your input or cited web sources" />
          <CardBody>
            {research.verified_information.length ? (
              <ul className="space-y-2">
                {research.verified_information.map((v, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] text-ink-700">
                    <Badge tone={v.basis === 'web' ? 'green' : 'slate'} className="mt-0.5 shrink-0">{v.basis === 'web' ? 'Web' : 'Your input'}</Badge>
                    <span>
                      {v.statement}
                      {v.source_url && (
                        <a href={v.source_url} target="_blank" rel="noreferrer noopener" className="ml-1 inline-flex items-center text-brand-700 hover:underline">
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">No verifiable facts were provided beyond the company name.</p>
            )}
          </CardBody>
        </Card>
        <Card className="border-amber-100">
          <CardHeader icon={<Lightbulb className="size-4" />} title={<span className="flex items-center gap-2">AI hypotheses <AiLabel>Unverified</AiLabel></span>} description="Assumptions the AI made — confirm before using" />
          <CardBody>
            <ul className="space-y-2">
              {research.ai_hypotheses.map((h, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] text-ink-700">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />
                  {h}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ListBlock icon={<TriangleAlert className="size-4" />} title="Likely challenges" items={research.likely_challenges} tone="amber" />
        <ListBlock icon={<ListChecks className="size-4" />} title="Customer needs" items={research.customer_needs} />
        <ListBlock icon={<Wand2 className="size-4" />} title="Use cases for your product" items={research.product_use_cases} tone="sky" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <TextBlock icon={<Sparkles className="size-4" />} title="Value proposition" text={research.value_proposition} />
        <TextBlock icon={<Compass className="size-4" />} title="Recommended sales approach" text={research.sales_approach} />
        <TextBlock icon={<Megaphone className="size-4" />} title="Outreach angle" text={research.outreach_angle} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ListBlock icon={<HelpCircle className="size-4" />} title="Verify before outreach" items={research.information_gaps} tone="amber" />
        {research.sources.length > 0 && (
          <Card>
            <CardHeader icon={<Globe className="size-4" />} title="Sources" />
            <CardBody>
              <ul className="space-y-1.5">
                {research.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-[13px] text-brand-700 hover:underline">
                      <ExternalLink className="size-3" /> {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    </motion.div>
  );
}

export default function Research() {
  const { data: leads = [] } = useLeads();
  const { data: profile } = useProfile();
  const { data: status } = useQuery({ queryKey: ['ai-status'], queryFn: getAiStatus, staleTime: 5 * 60_000, retry: false });
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [leadId, setLeadId] = useState<string | null>(params.get('lead'));
  const [form, setForm] = useState({ company_name: '', website: '', industry: '', description: '', target_customer: '', product: '' });
  const [useLive, setUseLive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const lead = useMemo(() => leads.find((l) => l.id === leadId) ?? null, [leads, leadId]);
  const liveAvailable = Boolean(status?.live_search.configured);

  // Pre-fill from the selected lead and the user's profile.
  useEffect(() => {
    setForm((f) => ({
      company_name: lead?.company ?? f.company_name,
      website: lead ? (lead.website ?? '') : f.website,
      industry: lead ? (lead.industry ?? '') : f.industry,
      description: lead ? [lead.requirements, lead.notes].filter(Boolean).join('\n\n') : f.description,
      target_customer: f.target_customer || profile?.target_customer || '',
      product: f.product || [profile?.product_name, profile?.product_description].filter(Boolean).join(' — '),
    }));
    setResult(lead?.research ?? null);
  }, [lead, leadId, profile]);

  const run = useMutation({
    mutationFn: async () => {
      const parsed = researchRequestSchema.safeParse({ ...form, lead_id: leadId ?? undefined, use_live_search: useLive && liveAvailable });
      if (!parsed.success) {
        setFormError(formatZodError(parsed.error));
        throw new Error('validation');
      }
      setFormError(null);
      return researchCompany(parsed.data);
    },
    onSuccess: async (r) => {
      setResult(r.research);
      if (r.saved_to_lead) {
        toast.success('Research saved to the lead');
        await refresh('leads', 'activities');
      }
    },
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run.mutate();
  };

  return (
    <div>
      <PageHeader
        eyebrow="AI Tools"
        title="AI Lead Research"
        description="Understand a prospect before you reach out: overview, likely challenges, needs, use cases for your product and the best outreach angle."
      />
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <Card className="h-fit xl:sticky xl:top-24">
          <CardHeader icon={<Building2 className="size-4" />} title="Company details" description="The more context you give, the better the analysis." />
          <CardBody>
            <form onSubmit={submit} className="space-y-4">
              <LeadPicker leads={leads} value={leadId} onChange={setLeadId} label="Research an existing lead (optional)" placeholder="Or fill the form manually…" />
              <Input label="Company name" required value={form.company_name} onChange={set('company_name')} placeholder="Northwind Labs" />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Input label="Website" value={form.website} onChange={set('website')} placeholder="northwind.com" />
                <div>
                  <Input label="Industry" value={form.industry} onChange={set('industry')} list="research-industries" placeholder="SaaS / Software" />
                  <datalist id="research-industries">{COMMON_INDUSTRIES.map((i) => <option key={i} value={i} />)}</datalist>
                </div>
              </div>
              <Textarea label="What do you know about them?" value={form.description} onChange={set('description')} rows={4} placeholder="Notes from their website, a call, LinkedIn… Only what you actually know." hint="Treated as verified facts — keep it accurate." />
              <Textarea label="Your target customer profile" value={form.target_customer} onChange={set('target_customer')} rows={2} placeholder="e.g. Ops leaders at 50–500 person B2B SaaS companies" />
              <Textarea label="Product / service you're selling" value={form.product} onChange={set('product')} rows={2} placeholder="e.g. Workflow automation for client onboarding" />

              <label className={`flex items-start gap-3 rounded-xl p-3 ring-1 ${liveAvailable ? 'cursor-pointer bg-lavender-25 ring-ink-100' : 'bg-ink-100/40 ring-ink-100'}`}>
                <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={useLive && liveAvailable} disabled={!liveAvailable} onChange={(e) => setUseLive(e.target.checked)} />
                <span className="text-[13px]">
                  <span className="flex items-center gap-1.5 font-medium text-ink-800"><Globe className="size-3.5" /> Use live web search</span>
                  <span className="mt-0.5 block text-ink-500">
                    {liveAvailable
                      ? `Provider: ${status?.live_search.provider}. Facts found online are cited with links.`
                      : 'Not configured. Research will use only your input (see Settings → AI configuration).'}
                  </span>
                </span>
              </label>

              {formError && <Alert tone="error">{formError}</Alert>}
              <Button type="submit" className="w-full" size="lg" icon={<Search className="size-4" />} loading={run.isPending}>
                {run.isPending ? 'Researching…' : 'Run AI research'}
              </Button>
            </form>
          </CardBody>
        </Card>

        <div className="min-w-0">
          {run.isPending ? (
            <Card className="p-6"><AiThinking label={`Researching ${form.company_name || 'company'}…`} lines={8} /></Card>
          ) : run.error && (run.error as Error).message !== 'validation' ? (
            <ErrorNotice error={run.error} />
          ) : result ? (
            <>
              <ResearchView research={result} />
              {lead && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" icon={<Target className="size-4" />} onClick={() => navigate(`/app/scoring?lead=${lead.id}`)}>Score this lead</Button>
                  <Button icon={<Sparkles className="size-4" />} onClick={() => navigate(`/app/emails?lead=${lead.id}`)}>Write an e-mail using this research</Button>
                </div>
              )}
            </>
          ) : (
            <Card>
              <EmptyState
                icon={<Search className="size-6" />}
                title="Research a prospect"
                description="Pick a lead or enter a company. You'll get an overview, likely challenges, needs, use cases, value proposition, a sales approach and an outreach angle — with verified facts clearly separated from AI guesses."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
