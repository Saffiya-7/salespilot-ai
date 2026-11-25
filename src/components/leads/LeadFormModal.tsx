import { useMutation } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { COMMON_INDUSTRIES, COMPANY_SIZES, LEAD_SOURCES, PIPELINE_STAGES, type PipelineStage } from '../../../shared/constants';
import { leadInputSchema } from '../../../shared/schemas';
import type { Lead } from '../../../shared/types';
import { useRefresh } from '../../hooks/useData';
import { createLead, toLeadRow, updateLead } from '../../services/leads';
import { toDateInput } from '../../utils/format';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

type FormState = Record<string, string>;

const EMPTY: FormState = {
  contact_name: '', company: '', email: '', phone: '', job_title: '', website: '', industry: '', company_size: '',
  location: '', source: 'Other', status: 'New Lead', budget: '', requirements: '', notes: '', deal_value: '',
  last_contacted_at: '', next_follow_up_at: '',
};

function fromLead(l: Lead): FormState {
  return {
    contact_name: l.contact_name,
    company: l.company,
    email: l.email ?? '',
    phone: l.phone ?? '',
    job_title: l.job_title ?? '',
    website: l.website ?? '',
    industry: l.industry ?? '',
    company_size: l.company_size ?? '',
    location: l.location ?? '',
    source: l.source,
    status: l.status,
    budget: l.budget ?? '',
    requirements: l.requirements ?? '',
    notes: l.notes ?? '',
    deal_value: l.deal_value === null ? '' : String(l.deal_value),
    last_contacted_at: toDateInput(l.last_contacted_at),
    next_follow_up_at: toDateInput(l.next_follow_up_at),
  };
}

export function LeadFormModal({
  open,
  onClose,
  lead,
  defaultStage,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  lead?: Lead | null;
  defaultStage?: PipelineStage;
  onSaved?: (lead: Lead) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const refresh = useRefresh();

  useEffect(() => {
    if (open) {
      setForm(lead ? fromLead(lead) : { ...EMPTY, status: defaultStage ?? 'New Lead' });
      setErrors({});
    }
  }, [open, lead, defaultStage]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = leadInputSchema.safeParse(form);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const k = String(issue.path[0] ?? '_');
          if (!errs[k]) errs[k] = issue.message;
        }
        setErrors(errs);
        throw new Error('Please fix the highlighted fields.');
      }
      setErrors({});
      // Keep the date fields only if they changed, so editing other fields doesn't shift stored times.
      const row = toLeadRow(parsed.data);
      if (lead) {
        if (form.last_contacted_at === toDateInput(lead.last_contacted_at)) row.last_contacted_at = lead.last_contacted_at;
        // next_follow_up_at is owned by the follow-ups table (kept in sync by services/followups)
        const { next_follow_up_at: _ignored, ...patch } = row;
        void _ignored;
        return updateLead(lead.id, patch, lead);
      }
      return createLead(parsed.data);
    },
    onSuccess: async (saved) => {
      toast.success(lead ? 'Lead updated' : 'Lead added');
      await refresh('leads', 'activities');
      onSaved?.(saved);
      onClose();
    },
  });

  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lead ? `Edit ${lead.contact_name}` : 'Add a lead'}
      description={lead ? lead.company : 'Contact name and company are required. Everything else helps the AI give better results.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="lead-form" loading={mutation.isPending}>
            {lead ? 'Save changes' : 'Add lead'}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={submit} className="space-y-6" noValidate>
        {mutation.error && !Object.keys(errors).length && <Alert tone="error">{(mutation.error as Error).message}</Alert>}
        <fieldset>
          <legend className="mb-3 text-xs font-semibold tracking-wider text-ink-400 uppercase">Contact</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Contact name" required value={form.contact_name} onChange={set('contact_name')} error={errors.contact_name} placeholder="Priya Sharma" maxLength={160} />
            <Input label="Job title" value={form.job_title} onChange={set('job_title')} error={errors.job_title} placeholder="Head of Operations" />
            <Input label="E-mail" type="email" value={form.email} onChange={set('email')} error={errors.email} placeholder="priya@company.com" />
            <Input label="Phone" value={form.phone} onChange={set('phone')} error={errors.phone} />
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-3 text-xs font-semibold tracking-wider text-ink-400 uppercase">Company</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Company" required value={form.company} onChange={set('company')} error={errors.company} placeholder="Northwind Labs" />
            <Input label="Website" value={form.website} onChange={set('website')} error={errors.website} placeholder="northwind.com" />
            <div>
              <Input label="Industry" value={form.industry} onChange={set('industry')} error={errors.industry} list="industry-options" placeholder="SaaS / Software" />
              <datalist id="industry-options">
                {COMMON_INDUSTRIES.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            </div>
            <Select label="Company size" value={form.company_size} onChange={set('company_size')} options={COMPANY_SIZES.map((s) => ({ value: s, label: `${s} employees` }))} placeholder="Unknown" />
            <Input label="Location" value={form.location} onChange={set('location')} error={errors.location} placeholder="Bengaluru, India" />
            <Select label="Lead source" value={form.source} onChange={set('source')} options={LEAD_SOURCES} />
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-3 text-xs font-semibold tracking-wider text-ink-400 uppercase">Deal</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Pipeline stage" value={form.status} onChange={set('status')} options={PIPELINE_STAGES} />
            <Input label="Deal value" inputMode="decimal" value={form.deal_value} onChange={set('deal_value')} error={errors.deal_value} placeholder="e.g. 12000" />
            <Input label="Budget indicators" value={form.budget} onChange={set('budget')} error={errors.budget} placeholder="e.g. Approved for Q1, ~10k/yr" />
            <Input label="Last contacted" type="date" value={form.last_contacted_at} onChange={set('last_contacted_at')} hint="Schedule follow-ups from the Follow-ups page." />
            <Textarea wrapperClassName="sm:col-span-2" label="Requirements / needs" value={form.requirements} onChange={set('requirements')} error={errors.requirements} placeholder="What are they looking for? Any pain points they mentioned?" />
            <Textarea wrapperClassName="sm:col-span-2" label="Notes" value={form.notes} onChange={set('notes')} error={errors.notes} placeholder="Context from calls, meetings, referrals…" />
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
