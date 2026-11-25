-- SalesPilot AI — initial schema
-- Tables: profiles, leads, lead_scores, generated_emails, followups,
--         sales_activities, ai_conversations, ai_request_log
-- Every table has Row Level Security: a signed-in user can only see and
-- change their own rows. The anon role gets no table access at all.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1 row per auth user, created automatically on signup)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  full_name           text check (char_length(full_name) <= 120),
  company_name        text check (char_length(company_name) <= 160),
  job_title           text check (char_length(job_title) <= 120),
  product_name        text check (char_length(product_name) <= 160),
  product_description text check (char_length(product_description) <= 2000),
  target_customer     text check (char_length(target_customer) <= 1000),
  value_proposition   text check (char_length(value_proposition) <= 1000),
  default_tone        text not null default 'Professional'
                      check (default_tone in ('Professional','Friendly','Persuasive','Formal','Short and Direct')),
  onboarding_completed boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_name      text not null check (char_length(contact_name) between 1 and 160),
  email             text check (email is null or char_length(email) <= 254),
  phone             text check (phone is null or char_length(phone) <= 40),
  job_title         text check (job_title is null or char_length(job_title) <= 160),
  company           text not null check (char_length(company) between 1 and 200),
  website           text check (website is null or char_length(website) <= 300),
  industry          text check (industry is null or char_length(industry) <= 120),
  company_size      text check (company_size is null or company_size in
                      ('1-10','11-50','51-200','201-500','501-1000','1001-5000','5000+')),
  location          text check (location is null or char_length(location) <= 160),
  source            text not null default 'Other' check (source in
                      ('Website','Referral','LinkedIn','Cold Outreach','Event','Partner','Advertising','CSV Import','Other')),
  status            text not null default 'New Lead' check (status in
                      ('New Lead','Contacted','Interested','Meeting Scheduled','Proposal Sent','Negotiation','Won','Lost')),
  budget            text check (budget is null or char_length(budget) <= 200),
  requirements      text check (requirements is null or char_length(requirements) <= 4000),
  notes             text check (notes is null or char_length(notes) <= 8000),
  deal_value        numeric(14,2) check (deal_value is null or deal_value >= 0),
  score             smallint check (score is null or score between 0 and 100),
  score_label       text check (score_label is null or score_label in ('Hot','Warm','Cold')),
  scored_at         timestamptz,
  research          jsonb,
  researched_at     timestamptz,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  status_changed_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index leads_user_created_idx on public.leads (user_id, created_at desc);
create index leads_user_status_idx on public.leads (user_id, status);
create index leads_user_followup_idx on public.leads (user_id, next_follow_up_at);
-- one lead per e-mail address per user (case-insensitive), blank e-mails allowed
create unique index leads_user_email_unique
  on public.leads (user_id, lower(email))
  where email is not null and email <> '';

create or replace function public.leads_track_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

create trigger leads_track_status
  before update on public.leads
  for each row execute function public.leads_track_status();

-- ---------------------------------------------------------------------------
-- lead_scores (history of AI score estimates)
-- ---------------------------------------------------------------------------
create table public.lead_scores (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id             uuid not null references public.leads (id) on delete cascade,
  score               smallint not null check (score between 0 and 100),
  label               text not null check (label in ('Hot','Warm','Cold')),
  explanation         text not null,
  factors             jsonb not null default '{}'::jsonb,
  positive_indicators text[] not null default '{}',
  risk_factors        text[] not null default '{}',
  next_action         text not null,
  data_completeness   text check (data_completeness in ('low','medium','high')),
  model               text,
  created_at          timestamptz not null default now()
);

create index lead_scores_lead_idx on public.lead_scores (lead_id, created_at desc);
create index lead_scores_user_idx on public.lead_scores (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- generated_emails (cold e-mails and follow-up messages produced by the AI)
-- ---------------------------------------------------------------------------
create table public.generated_emails (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id           uuid references public.leads (id) on delete set null,
  kind              text not null default 'cold' check (kind in ('cold','followup')),
  action            text not null default 'generate' check (action in
                      ('generate','variants','rewrite','shorten','personalize','followup')),
  tone              text,
  prospect_name     text,
  company           text,
  subject           text not null,
  opening           text,
  problem_statement text,
  value_proposition text,
  cta               text,
  body              text not null,
  is_saved          boolean not null default false,
  input             jsonb not null default '{}'::jsonb,
  model             text,
  created_at        timestamptz not null default now()
);

create index generated_emails_user_idx on public.generated_emails (user_id, created_at desc);
create index generated_emails_lead_idx on public.generated_emails (lead_id);

-- ---------------------------------------------------------------------------
-- followups
-- ---------------------------------------------------------------------------
create table public.followups (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id      uuid not null references public.leads (id) on delete cascade,
  due_at       timestamptz not null,
  channel      text not null default 'email' check (channel in ('email','call','linkedin','meeting','other')),
  status       text not null default 'pending' check (status in ('pending','completed','skipped')),
  note         text check (note is null or char_length(note) <= 2000),
  message      text check (message is null or char_length(message) <= 8000),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index followups_user_due_idx on public.followups (user_id, status, due_at);
create index followups_lead_idx on public.followups (lead_id);

create trigger followups_set_updated_at
  before update on public.followups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sales_activities (timeline)
-- ---------------------------------------------------------------------------
create table public.sales_activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id     uuid references public.leads (id) on delete cascade,
  type        text not null check (type in (
                'lead_created','lead_updated','stage_changed','note','call','meeting',
                'email_generated','email_sent','followup_scheduled','followup_completed',
                'lead_scored','research_completed','import')),
  description text not null check (char_length(description) <= 1000),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index sales_activities_user_idx on public.sales_activities (user_id, created_at desc);
create index sales_activities_lead_idx on public.sales_activities (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ai_conversations (AI Sales Assistant chat history)
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null default 'New conversation' check (char_length(title) <= 200),
  messages   jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ai_request_log (used by the Netlify Functions for per-user rate limiting)
-- ---------------------------------------------------------------------------
create table public.ai_request_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null check (char_length(endpoint) <= 60),
  created_at timestamptz not null default now()
);

create index ai_request_log_user_idx on public.ai_request_log (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.leads            enable row level security;
alter table public.lead_scores      enable row level security;
alter table public.generated_emails enable row level security;
alter table public.followups        enable row level security;
alter table public.sales_activities enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_request_log   enable row level security;

-- The public "anon" role (not signed in) never touches app tables.
revoke all on public.profiles, public.leads, public.lead_scores, public.generated_emails,
  public.followups, public.sales_activities, public.ai_conversations, public.ai_request_log
  from anon;

grant select, insert, update, delete on public.profiles, public.leads, public.lead_scores,
  public.generated_emails, public.followups, public.sales_activities, public.ai_conversations
  to authenticated;
grant select, insert on public.ai_request_log to authenticated;

-- profiles: a user can read and update only their own profile.
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- leads
create policy "leads_select_own" on public.leads
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "leads_insert_own" on public.leads
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "leads_update_own" on public.leads
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "leads_delete_own" on public.leads
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Child tables: the row must be yours AND any referenced lead must be yours too.
create or replace function public.owns_lead(p_lead_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_lead_id is null
      or exists (select 1 from public.leads l where l.id = p_lead_id and l.user_id = (select auth.uid()));
$$;

-- lead_scores
create policy "lead_scores_select_own" on public.lead_scores
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "lead_scores_insert_own" on public.lead_scores
  for insert to authenticated with check ((select auth.uid()) = user_id and public.owns_lead(lead_id));
create policy "lead_scores_delete_own" on public.lead_scores
  for delete to authenticated using ((select auth.uid()) = user_id);

-- generated_emails
create policy "generated_emails_select_own" on public.generated_emails
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "generated_emails_insert_own" on public.generated_emails
  for insert to authenticated with check ((select auth.uid()) = user_id and public.owns_lead(lead_id));
create policy "generated_emails_update_own" on public.generated_emails
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_lead(lead_id));
create policy "generated_emails_delete_own" on public.generated_emails
  for delete to authenticated using ((select auth.uid()) = user_id);

-- followups
create policy "followups_select_own" on public.followups
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "followups_insert_own" on public.followups
  for insert to authenticated with check ((select auth.uid()) = user_id and public.owns_lead(lead_id));
create policy "followups_update_own" on public.followups
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_lead(lead_id));
create policy "followups_delete_own" on public.followups
  for delete to authenticated using ((select auth.uid()) = user_id);

-- sales_activities
create policy "sales_activities_select_own" on public.sales_activities
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "sales_activities_insert_own" on public.sales_activities
  for insert to authenticated with check ((select auth.uid()) = user_id and public.owns_lead(lead_id));
create policy "sales_activities_delete_own" on public.sales_activities
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ai_conversations
create policy "ai_conversations_select_own" on public.ai_conversations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_conversations_insert_own" on public.ai_conversations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ai_conversations_update_own" on public.ai_conversations
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ai_conversations_delete_own" on public.ai_conversations
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ai_request_log: insert + read own rows only (no update/delete, so limits can't be reset)
create policy "ai_request_log_select_own" on public.ai_request_log
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_request_log_insert_own" on public.ai_request_log
  for insert to authenticated with check ((select auth.uid()) = user_id);
