// POST /api/generate-followup  { lead_id, followup_id?, tone?, context? }
// Drafts a context-aware follow-up and recommends timing based on the lead's
// real history. It is stored as a draft; the user decides if/when to send it.
import { followupAiSchema, followupRequestSchema } from '../../shared/schemas';
import { clamp } from '../../shared/scoring';
import type { Lead } from '../../shared/types';
import { dataBlock, generateJson, SHARED_RULES } from '../lib/gemini';
import { createHandler } from '../lib/handler';
import { HttpError } from '../lib/http';
import { followupSchema } from '../lib/responseSchemas';
import { TONE_GUIDE } from '../lib/tones';

const SYSTEM = `You are a B2B sales coach writing follow-up messages.
Use the lead's actual history (stage, last contact, previous e-mails, notes, follow-ups) to write a short, relevant follow-up that adds value — not "just checking in".
Reference previous touchpoints only if they appear in the data. Never invent meetings, replies, promises or facts.
Recommend timing: consider days since last contact, the pipeline stage and any overdue follow-ups. Typical cadence: 2–4 days after first outreach, 5–7 days later for the next touch, sooner when a deal is in Proposal/Negotiation.
Choose the best channel (email, call, linkedin, meeting, other) given the history.
Sign e-mails with [Your name].
${SHARED_RULES}`;

export default createHandler('generate-followup', { schema: followupRequestSchema }, async (input, { supabase, user }) => {
  const { data: leadData } = await supabase.from('leads').select('*').eq('id', input.lead_id).maybeSingle();
  if (!leadData) throw new HttpError(404, 'NOT_FOUND', 'Lead not found.');
  const lead = leadData as Lead;

  const [profile, activities, emails, followups] = await Promise.all([
    supabase.from('profiles').select('company_name,product_name,product_description,value_proposition').eq('id', user.id).maybeSingle(),
    supabase.from('sales_activities').select('type,description,created_at').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('generated_emails').select('subject,body,kind,is_saved,created_at').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(3),
    supabase.from('followups').select('id,due_at,status,channel,note,completed_at').eq('lead_id', lead.id).order('due_at', { ascending: false }).limit(10),
  ]);
  if (input.followup_id && !(followups.data ?? []).some((f) => f.id === input.followup_id)) {
    throw new HttpError(404, 'NOT_FOUND', 'Follow-up not found for this lead.');
  }

  const now = new Date();
  const daysSince = lead.last_contacted_at ? Math.floor((now.getTime() - new Date(lead.last_contacted_at).getTime()) / 86_400_000) : null;

  const prompt = [
    `Today is ${now.toISOString().slice(0, 10)}. Tone: ${input.tone} — ${TONE_GUIDE[input.tone]}.`,
    dataBlock('seller', profile.data ?? {}),
    dataBlock('lead', {
      contact_name: lead.contact_name,
      job_title: lead.job_title,
      company: lead.company,
      industry: lead.industry,
      stage: lead.status,
      requirements: lead.requirements,
      notes: lead.notes,
      last_contacted: lead.last_contacted_at?.slice(0, 10) ?? 'never',
      days_since_last_contact: daysSince,
      ai_score: lead.score,
      research_outreach_angle: lead.research?.outreach_angle ?? null,
    }),
    dataBlock('history', {
      activities: (activities.data ?? []).map((a) => ({ date: a.created_at.slice(0, 10), type: a.type, description: a.description })),
      previous_emails: (emails.data ?? []).map((e) => ({ date: e.created_at.slice(0, 10), subject: e.subject, excerpt: e.body.slice(0, 500) })),
      followups: (followups.data ?? []).map((f) => ({ due: f.due_at.slice(0, 10), status: f.status, channel: f.channel, note: f.note })),
    }),
    input.context ? dataBlock('sender_context', input.context) : '',
    'Write the follow-up JSON.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const { data, model } = await generateJson({ system: SYSTEM, prompt, schema: followupSchema, validator: followupAiSchema, temperature: 0.55, maxOutputTokens: 2048 });
  const draft = { ...data, recommended_days_from_now: Math.round(clamp(data.recommended_days_from_now, 0, 30)) };

  const { data: rec, error } = await supabase
    .from('generated_emails')
    .insert({
      lead_id: lead.id,
      kind: 'followup',
      action: 'followup',
      tone: input.tone,
      prospect_name: lead.contact_name,
      company: lead.company,
      subject: draft.subject,
      body: draft.body,
      input: { channel: draft.channel, followup_id: input.followup_id ?? null },
      model,
    })
    .select('id')
    .single();
  if (error) console.warn('[generate-followup] could not store draft', error.message);

  if (input.followup_id) {
    await supabase.from('followups').update({ message: draft.body.slice(0, 8000) }).eq('id', input.followup_id);
  }
  await supabase.from('sales_activities').insert({
    lead_id: lead.id,
    type: 'email_generated',
    description: `AI drafted a ${draft.channel} follow-up (suggested in ${draft.recommended_days_from_now} day${draft.recommended_days_from_now === 1 ? '' : 's'})`,
    metadata: { kind: 'followup' },
  });

  return { draft, email_id: rec?.id ?? null, model };
});
