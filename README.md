# SalesPilot AI

**Find Better Leads. Sell Smarter. Close Faster.**

SalesPilot AI is an AI sales-intelligence and automation app for startups, agencies, B2B sales teams, founders and business-development people. It researches prospects, scores leads with AI, writes personalised cold e-mails and follow-ups, manages your pipeline, and turns your real data into analytics and recommendations.

It is **not** a chatbot wrapper: every AI feature works on the leads stored in *your* database, and the app is careful about honesty:

- Research keeps **verified facts** (things you typed, or cited web results) separate from **AI hypotheses**.
- Lead scores are labelled **AI estimates** of fit — never "probability of closing".
- E-mails never invent personal facts about a prospect; unknown details become `[placeholders]`.
- **Nothing is ever e-mailed automatically.** You copy a draft or open it in your own mail app.
- The AI Sales Assistant **queries your data before answering** and is told never to make up numbers.
- If the Gemini key is missing you get a clear "AI is not configured" message — never fake AI output.

---

## Contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [What you need (accounts & keys)](#what-you-need)
5. [Run it on your computer](#run-it-on-your-computer)
6. [Set up Supabase (database + login)](#set-up-supabase)
7. [Get a Gemini API key](#get-a-gemini-api-key)
8. [Deploy: GitHub → Netlify](#deploy-github--netlify)
9. [Optional: live web search for research](#optional-live-web-search)
10. [Security](#security)
11. [Tests & quality checks](#tests--quality-checks)
12. [Troubleshooting](#troubleshooting)

---

## Features

| Page | What it does |
| --- | --- |
| **Landing** | Product homepage. |
| **Login / Signup** | E-mail + password auth, password reset (Supabase Auth). |
| **Dashboard** | Total / Qualified / High-priority leads, Emails generated, Follow-ups due, Conversion rate; lead-growth, pipeline and lead-source charts; recent leads, activity, upcoming follow-ups; AI insights. An onboarding checklist and empty states appear for new accounts. |
| **Lead Management** | Add / edit / delete leads (delete asks to confirm), search, filter (stage, industry, AI score, source), sort, lead detail drawer with activity history and notes. **CSV import** (upload → column mapping → preview → required-field validation → duplicate detection → import) and **CSV export** of filtered leads. |
| **AI Lead Research** | Company overview, industry classification, likely challenges, customer needs, use cases for your product, value proposition, sales approach, outreach angle — with verified info vs. hypotheses and information gaps. |
| **AI Lead Scoring** | 0–100 estimate across 7 factors (industry relevance, company size, requirements, budget indicators, decision-maker relevance, product fit, engagement), Hot/Warm/Cold, explanation, positive indicators, risk factors, next action, score history. Edit the lead and regenerate. |
| **Email Generator** | Five tones (Professional, Friendly, Persuasive, Formal, Short and Direct). Subject, opening, problem, value proposition, CTA and full body. Generate 3 versions, rewrite, shorten, improve personalisation, copy, save to library, export `.txt`, open in your mail app. |
| **Follow-ups** | Track last contact and next follow-up, overdue flags, AI-drafted follow-ups with recommended timing and channel, history, complete / skip / reschedule, update the lead's stage. |
| **Sales Pipeline** | Kanban with 8 stages (New Lead → Won/Lost), drag-and-drop (or a stage menu on touch screens), search and filters, deal values per stage. |
| **Sales Analytics** | Conversion & win rate, funnel, pipeline performance, industry and source performance, monthly growth, follow-up completion, weekly activity report, AI recommendations. **CSV and PDF report downloads.** |
| **AI Sales Assistant** | Chat that answers "which leads should I prioritise today?", "which need follow-up?", "best industries?", "write a cold e-mail for Northwind"… using a fresh snapshot of your data. Chats are saved. |
| **Settings** | Profile, what you sell (used by every AI feature), default tone, AI configuration status, password change, export all leads. |

---

## Tech stack

- **Frontend:** React 19, Vite 8, TypeScript, Tailwind CSS 4, Framer Motion, Lucide icons, Recharts, TanStack Query, React Router.
- **AI:** Google Gemini via the official `@google/genai` SDK, structured JSON output (response schemas) + Zod validation of every response, retries with back-off. Default model `gemini-3.6-flash` (change with `GEMINI_MODEL`).
- **Backend:** Netlify Functions (TypeScript) at `/api/*`.
- **Database & auth:** Supabase (Postgres + Auth + Row Level Security).
- **Other:** Papa Parse (CSV), jsPDF + autotable (PDF reports), Vitest (tests).

---

## Project structure

```
salespilot-ai/
├─ src/
│  ├─ components/      UI kit (ui/), charts, lead components (form, drawer, CSV import, picker…)
│  ├─ contexts/        AuthContext (Supabase session)
│  ├─ hooks/           data hooks (TanStack Query)
│  ├─ layouts/         App layout (sidebar), auth layout
│  ├─ lib/             supabase client, API client, CSV logic
│  ├─ pages/           the 12 pages (+ auth/ and NotFound)
│  ├─ services/        database + AI function calls
│  ├─ types/           re-exported types
│  └─ utils/           formatting, filters, reports (CSV/PDF), markdown, downloads
├─ shared/             code used by BOTH the browser and the functions
│                      (constants, Zod schemas, metric calculations, scoring & research guards)
├─ netlify/
│  ├─ functions/       research-company, score-lead, generate-email, generate-followup,
│  │                   sales-assistant, generate-insights, ai-status
│  └─ lib/             auth (JWT check), Gemini client, rate limiting, retrieval, prompts
├─ supabase/migrations/  SQL: tables, indexes, triggers, Row Level Security policies
├─ scripts/            dev-only Vite plugin that runs the functions locally
├─ tests/              Vitest unit tests
├─ public/             favicon
├─ netlify.toml  vite.config.ts  tsconfig*.json  .env.example  package.json
```

---

## What you need

| Thing | Where | Cost |
| --- | --- | --- |
| Node.js 20.19+ (you have 22 ✔) | nodejs.org | free |
| A **Supabase** project | supabase.com | free tier is enough |
| A **Gemini API key** | aistudio.google.com/apikey | free tier available; paid usage is billed by Google |
| A **GitHub** account (for deploy) | github.com | free |
| A **Netlify** account (for deploy) | netlify.com | free tier is enough |

> 🔐 You add all keys yourself. Never paste keys into chat, screenshots or code files. Only `.env` (which is git-ignored) and the Netlify dashboard.

---

## Run it on your computer

Open PowerShell in the `salespilot-ai` folder.

**1. Install packages** (once):

```powershell
npm install
```

**2. Create your `.env` file** from the example:

```powershell
Copy-Item .env.example .env
```

Open `.env` in a text editor and fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `GEMINI_API_KEY` (see the next two sections for where to find them).

**3. Start the app:**

```powershell
npm run dev
```

Open the address it prints (usually http://localhost:5173). `npm run dev` also runs the AI functions locally (a small dev plugin serves `netlify/functions/*` at `/api/*`), so you do **not** need the Netlify CLI.

> Without a `.env`, the app still opens: the homepage works and the app shows a "Connect your Supabase project" screen with instructions.

---

## Set up Supabase

1. Go to **supabase.com → New project**. Pick a name and a strong database password (save it in your password manager). Choose the region closest to your users. Wait ~2 minutes.
2. **Create the tables:** in the left menu open **SQL Editor → New query**. Open the file `supabase/migrations/20261125000001_initial_schema.sql` from this project, copy **all** of it, paste it into the editor and click **Run**. You should see "Success. No rows returned".
   - This creates `profiles, leads, lead_scores, generated_emails, followups, sales_activities, ai_conversations` (+ `ai_request_log` for rate limiting), turns on **Row Level Security** on every table and adds per-user policies.
   - (Advanced, optional: with the Supabase CLI you can instead run `supabase link` and `supabase db push`.)
3. **Get your keys:** **Project Settings → API** (or **Settings → API Keys**):
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key, or the **publishable** key (`sb_publishable_…`) → `VITE_SUPABASE_ANON_KEY`
   - ⚠️ Do **not** use the `service_role` / `secret` key anywhere. SalesPilot never needs it (the app refuses to start if it sees one in the browser config).
4. **Auth URLs:** **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:5173` for now (change to your Netlify URL after deploying).
   - **Redirect URLs:** add `http://localhost:5173/**` (and later `https://YOUR-SITE.netlify.app/**`). This is needed for sign-up confirmation and password-reset links.
5. **E-mail confirmation (optional):** by default Supabase asks new users to confirm their e-mail. The built-in mail sender is rate-limited and meant for testing; for real users add your own SMTP under **Authentication → Emails → SMTP settings**, or turn off "Confirm email" while testing (**Authentication → Sign In / Providers → Email**).

---

## Get a Gemini API key

1. Open **aistudio.google.com/apikey** and sign in with your Google account.
2. Click **Create API key**, copy it, and paste it into `.env` as `GEMINI_API_KEY=...`.
3. Restart `npm run dev`. In the app, **Settings → AI configuration** should now show "Google Gemini — Connected".

The key is used **only on the server** (Netlify Functions). It is never sent to the browser.

---

## Deploy: GitHub → Netlify

### 1. Put the code on GitHub

1. Go to **github.com/new**, name it `salespilot-ai`, keep it **empty** (no README, no .gitignore), click **Create repository**.
2. In PowerShell, inside the `salespilot-ai` folder:

```powershell
git add .
```

```powershell
git commit -m "SalesPilot AI"
```

```powershell
git branch -M main
```

```powershell
git remote add origin https://github.com/YOUR-USERNAME/salespilot-ai.git
```

```powershell
git push -u origin main
```

(A browser window may ask you to log in to GitHub — that's Git Credential Manager; approve it.) Your `.env` is **not** uploaded — `.gitignore` excludes it.

### 2. Import the repo in Netlify

1. Go to **app.netlify.com → Add new project → Import an existing project → GitHub**, authorise, and pick `salespilot-ai`.
2. Netlify reads `netlify.toml`, so the settings fill in automatically: build command `npm run build`, publish directory `dist`, functions directory `netlify/functions`.
3. Before (or right after) the first deploy, open **Site configuration → Environment variables → Add a variable** and add, with scope **All** (so both the build and the functions can read them):

| Key | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon / publishable key |
| `GEMINI_API_KEY` | your Gemini key (mark as **secret** if offered) |
| `GEMINI_MODEL` *(optional)* | e.g. `gemini-3.6-flash` |

4. **Deploys → Trigger deploy → Deploy site** (env var changes only apply to new deploys).
5. Back in **Supabase → Authentication → URL Configuration**, set **Site URL** to your Netlify address (e.g. `https://salespilot-ai.netlify.app`) and add `https://salespilot-ai.netlify.app/**` to **Redirect URLs**.

That's it — sign up on your live site and start adding leads.

> If you later use a custom domain for Supabase (not `*.supabase.co`), add it to the `connect-src` part of the `Content-Security-Policy` header in `netlify.toml`.

---

## Optional: live web search

By default AI research analyses **only what you type** and says so on screen. To let it cite real web pages, add on Netlify (and in `.env` locally):

- `LIVE_SEARCH_PROVIDER=gemini` — uses Gemini's *Grounding with Google Search* with your existing key (Google may bill grounding separately), **or**
- `LIVE_SEARCH_PROVIDER=tavily` and `TAVILY_API_KEY=...` (tavily.com).

Then tick **"Use live web search"** on the research page. Facts from search are shown with their source links; a fact the AI claims is "from the web" but whose URL wasn't actually returned by the search is automatically moved to "AI hypotheses (unverified)".

---

## Security

- **Row Level Security** on every table: a user can only read/write their own rows; child rows (scores, e-mails, follow-ups, activities) can only point at the user's own leads. The anonymous role has no table access.
- **Functions verify the Supabase JWT** (`Authorization: Bearer …`) with Supabase Auth, then query the database **as that user**, so RLS applies to the AI features too. No service-role key is used anywhere.
- **Server-side validation** of every request with Zod (types, lengths, UUIDs, allowed values) and a 32 KB body limit.
- **AI responses are validated** against schemas; invalid output is retried once, then reported as an error — never shown as if it were real.
- **Rate limits** per user: 10 AI requests/minute and 200/day by default (`AI_RATE_LIMIT_PER_MINUTE`, `AI_RATE_LIMIT_PER_DAY`), enforced via the `ai_request_log` table plus an in-memory guard.
- **Prompt-injection hygiene:** user/database text is wrapped in data tags and the model is told never to follow instructions inside them.
- **Safe errors:** internal errors are logged on the server; users see a generic message.
- **Secrets only in env vars**; `.env` is git-ignored; security headers + CSP in `netlify.toml`; CSV exports neutralise spreadsheet formulas.
- **No automatic e-mail sending.** Drafts are copied or opened in your own mail app; "I sent this" only records it.

---

## Tests & quality checks

```powershell
npm test
```

```powershell
npm run typecheck
```

```powershell
npm run build
```

or everything at once: `npm run check`.

The tests (Vitest, `tests/`) cover CSV parsing / column mapping / validation / duplicate detection / formula-safe export, score normalisation and AI-response validation, the research "verified vs hypothesis" guard, all dashboard & analytics metric calculations, function input validation, the function pipeline (method, JWT, validation-before-rate-limit, missing-key message, rate limiting, error hiding) with a mocked Supabase, the Gemini wrapper's retry / re-ask / error mapping logic, assistant retrieval helpers, and CSV/PDF report generation.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Connect your Supabase project" screen | `.env` is missing or has empty `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Fill them in and restart `npm run dev`. On Netlify: add the variables and redeploy. |
| "Database tables are missing" | Run the SQL migration (Supabase step 2). |
| "AI is not configured yet" | Add `GEMINI_API_KEY` (and restart / redeploy). |
| "The AI model … is not available" | Set `GEMINI_MODEL` to a model your key can use (see ai.google.dev → Models). |
| "Too many AI requests" | You hit the per-user rate limit; wait a minute (or raise the limits). |
| Sign-up says "check your inbox" but no e-mail arrives | Supabase's test mail sender is rate-limited. Configure SMTP or disable e-mail confirmation while testing. |
| Password-reset / confirmation link goes to the wrong site | Fix **Site URL** and **Redirect URLs** in Supabase → Authentication → URL Configuration. |
| Netlify build fails | Check the deploy log; make sure the env vars are set with scope **All**, then **Clear cache and deploy**. |
