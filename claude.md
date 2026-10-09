# Wellspring Grants — Claude Code Project Context
*Last updated: August 7, 2026*

---

## What This Project Is

Wellspring Grants is now two connected pieces working together:

**1. The paid service (existing, ~95% built, live in production).**
Nonprofits pay $450, submit an intake form, and receive a professionally
formatted, submission-ready grant application within 48 hours. Emily does
a 20-minute quality review before delivery. Backend: intake form → Stripe
payment → Claude API grant generation → Google Docs creation → admin
review → client delivery via email. This part works and has been tested
end-to-end with a real delivered grant. **Do not rebuild this — extend it
only when explicitly asked.**

**2. The discovery site (new, not yet built — the current focus).**
A programmatic SEO content site living at `wellspringgrants.com/grants/...`.
Nonprofit staff search things like "grants for youth sports nonprofits in
Massachusetts," land on a page with real, current grant listings for that
cause + state, and are offered email signup for deadline alerts. The email
list is the actual near-term asset; visitors convert into paid customers
of piece #1 above over time. Built as static pages generated from a
Postgres database — no app for visitors to load, just fast HTML, which is
what search engines reward.

**Why this exists:** the original distribution plan (cold email outreach
to nonprofit EDs) is retired — see "Distribution & Growth Model" below.
Emily has very limited ongoing capacity and will not do manual prospecting,
sales calls, or personal-brand building. Distribution now has to come from
people finding this on their own.

---

## Owner Context

Owner: Emily
Day job: Technical Project Manager (40–50 hrs/week)
Family: Two small children — time is extremely limited
Claude Code experience: Beginner, willing to learn on the job
Time available for Wellspring:
  - ~1 hour/week during active build phases (the discovery-site pilot
    build counts as this)
  - ~1 hour/month steady-state maintenance once something is live — any
    design choice that creates recurring manual work must be flagged and
    automated instead, not left for Emily to do by hand
Priority at every decision point: automation over manual work
Personal constraint: This side hustle must NOT be visible to Salesforce
colleagues — keep domain/branding fully separate. No personal-brand
content, no LinkedIn, no video, no public speaking tied to Emily's name.

---

## Business Model

### Pricing — the paid service (unchanged)

Launch (Months 1–3):
- Single grant application: $450
- Bundle of 3 applications: $1,100
- Monthly retainer (up to 4 apps/month): $1,400/month
- Rush delivery add-on: +$150

Standard (Month 4+):
- Single grant application: $600
- Bundle of 3 applications: $1,500
- Monthly retainer: $1,800/month

Promo code: FIRSTGRANT
- 100 uses max, expires 12 months from creation
- Bypasses Stripe entirely, routes directly to generation
- Tracks as is_comp: true in database

Target client: Small nonprofit EDs, annual budget $100k–$2M

### Distribution & Growth Model (REPLACES cold email outreach)

**Old plan (retired):** cold email to EDs sourced from ProPublica Nonprofit
Explorer, 30/day from Gmail. **Do not resume this** — it required manual,
ongoing, weekly effort Emily no longer has and does not want.

**New plan:** search-led distribution via programmatic SEO, validated in
stages before scaling investment:

- **Stage 0 — cheap paid-traffic validation.** Before any SEO
  infrastructure is built, run a small paid-search test (~$20–60, no-code
  landing page, 10 long-tail keywords) to check whether the underlying
  offer converts strangers into email signups at all. This is the
  highest-leverage, cheapest, fastest risk to retire — it doesn't depend
  on Google indexing timelines.
- **Stage 1 — pilot.** ~20 hand-curated pages (one cause area × 4–5
  states), built as static pages from a new Postgres data layer,
  submitted to Google Search Console. No scraping, no scheduled
  ingestion — data is manually/Claude-researched and verified for this
  stage only.
- **Decision gate at ~8–10 weeks:** are the pilot pages indexed and
  drawing any impressions? If yes, proceed to Stage 2. If not indexing
  at all, treat it as a technical problem to fix, not evidence to wait
  out longer.
- **Stage 2 — scale (gated, do not start early).** Full automated
  ingestion pipeline (Grants.gov, ProPublica/IRS 990-PF, select state
  portals), scheduled freshness/expiry job, LLM-based cause tagging,
  full page set across all cause × state combinations that clear the
  content floor (see Data Layer below).
- **Realistic timeline:** near-zero traffic months 1–4 (normal for a new
  domain), first meaningful impressions months 5–9, real verdict at
  month 12. Do not treat early silence as failure.

ProPublica Nonprofit Explorer and IRS 990-PF filings are still referenced
in this plan, but repurposed: previously a source for finding EDs to
cold-email, now a data source for foundation giving-history data feeding
the grants database (Stage 2 only).

Zero social media. Zero LinkedIn. Zero personal-brand content. At most
one low-effort passive channel (e.g. a one-time Product Hunt launch) —
never a channel requiring ongoing weekly effort.

**Second business ("Chaos to Clarity"): DO NOT BUILD YET.**
AI-powered operations documentation for small businesses. Only start when
Wellspring reaches $3k+/month consistently for 6+ consecutive weeks. Keep
entirely separate from this codebase forever.

---

## Product Architecture

Two pieces, one Postgres database, one deploy:

1. **Core service app** — `server.js` and everything in the existing file
   map. Tables: `submissions`, `promo_codes`. Owns the intake → payment →
   generation → delivery pipeline. **Never modify its tables or core
   routes as a side effect of discovery-site work.**
2. **Discovery site** — new `site/` directory (Astro). Builds to static
   HTML output served by the *same* Express app at `/grants/...` (no
   separate hosting account, no second domain, one `git push` deploys
   both). Reads from new, separate tables only: `funders`, `grants`,
   `cause_areas`, `geographies`, `subscribers`, `grant_causes`,
   `grant_geos`. Pages are generated at *build time* from the database —
   visitors never trigger a live DB query.
3. **One new runtime endpoint**: `POST /api/subscribe`, added to the
   existing `server.js`, purely additive, writes only to the new
   `subscribers` table. This is the only place the two pieces touch at
   runtime.

Funnel: search → discovery page (`/grants/[cause]/[state]`) → email
capture → nurture → convert to the paid service via the existing
`/apply` + Stripe flow, or the FIRSTGRANT promo.

**Why static output on the same domain instead of a separate host
(Vercel/Netlify):** keeps this at one deploy pipeline, one bill, one
login, for an owner with ~1 hour/month — and a subdirectory
(`wellspringgrants.com/grants/...`) benefits from the existing domain's
standing rather than starting a second domain from zero trust.

---

## Validation Staging — hard sequencing rule

Do not build Stage 2 infrastructure (automated ingestion, scraping,
scheduled freshness cron, LLM auto-tagging batch jobs, full 50-state page
set) before the Stage 1 pilot clears its decision gate. This applies even
if asked to "speed things up" mid-pilot — flag it and get explicit
confirmation rather than proceeding. Over-building ahead of validation is
the exact failure mode this plan is designed to avoid.

---

## Data Layer — Discovery Site

New tables (additive, alongside the existing `submissions` /
`promo_codes` — do not alter those):

- `funders` — name, type (federal / state / foundation / corporate), EIN,
  website, HQ location
- `grants` — title, funder_id, description, eligibility text, award_min,
  award_max, deadline, application_url, recurring flag, status
  (open/closed)
- `cause_areas` — slug, display name, synonyms
- `geographies` — state, slug, region
- `subscribers` — email, cause interests, geo, source page, created_at
- `grant_causes`, `grant_geos` — join tables enabling cause × state pages

**Content quality floor (non-negotiable):** a `/grants/[cause]/[state]`
page is only generated if it has 5+ live grants. Thin, near-duplicate
pages get deindexed and drag down the whole domain — this threshold is a
hard rule, not a nice-to-have.

**Absolute prohibition — carried over from the grant-writing engine's own
rule:** never invent, estimate, or extrapolate any grant fact — award
amount, deadline, eligibility, funder detail — not sourced from a
verified source (Grants.gov, IRS filings, the funder's own site, or
manually verified during the pilot). Same standard as `generateGrant.js`'s
ban on fabricated statistics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend server | Node.js + Express (server.js) |
| Core service frontend | Vanilla HTML/CSS — no frameworks |
| Discovery site | Astro, static output (`output: 'static'`), built into `public/grants/`, served by the existing Express app |
| AI engine | Anthropic claude-sonnet-4-6, 16k max tokens |
| Payments | Stripe Checkout + Webhook |
| Email | Resend API (sendEmail.js) |
| Documents | Google Docs API + Drive API (createDoc.js) |
| Database | Railway Postgres (db/queries.js) — shared by both pieces, separate tables |
| Authentication | HTTP Basic Auth on all /admin routes |
| Hosting | Railway (single deploy for both pieces) |
| Domain email | hello@wellspringgrants.com |
| Ad testing (Stage 0 only) | Google Ads + a no-code landing page tool (e.g. Carrd or Google Form) |
| Search indexing | Google Search Console |

---

## File Map

```
WellspringGrants/
├── server.js              — all Express routes (existing + new POST /api/subscribe)
├── generateGrant.js       — Claude API + 18-rule prompt engine (unchanged)
├── createDoc.js           — Google Docs formatting pipeline (unchanged)
├── sendEmail.js           — Resend confirmation + delivery emails (unchanged)
├── CLAUDE.md              — this file
├── TASKS.md               — full task list with status
├── OPERATING_GUIDE.md     — complete owner manual
├── RESEARCH.md            — comparison table research (to be built)
├── site/                  — NEW: Astro source for the discovery site
│   ├── src/pages/
│   │   ├── grants/[state].astro
│   │   ├── grants/[cause].astro
│   │   ├── grants/[cause]/[state].astro
│   │   ├── grant/[slug].astro
│   │   ├── funders/[slug].astro
│   │   └── guides/*.astro     — cornerstone human-written articles
│   └── astro.config.mjs       — outputs static build into ../public/grants
├── db/
│   ├── schema.sql             — UPDATED: adds funders, grants, cause_areas,
│   │                             geographies, subscribers, grant_causes, grant_geos
│   ├── queries.js             — existing submission/promo queries (unchanged)
│   ├── discovery-queries.js   — NEW: queries for the discovery-site tables
│   ├── migrate.js / seed.js / import-existing.js
├── public/
│   ├── index.html / apply.html / confirmation.html / payment-cancelled.html (unchanged)
│   └── grants/                — NEW: build output of site/, static HTML,
│                                 generated on build, not hand-edited
└── data/
    └── submissions.json   — LEGACY flat file backup (unchanged)
```

---

## Grant Engine Rules — DO NOT MODIFY WITHOUT DISCUSSION

Governs the paid writing service only. Unchanged.

generateGrant.js contains the core business logic.
Never modify these as a side effect of any other task:

- 18 Mandatory Writing Rules (Rules 1–18)
- 6-dimension weighted quality scoring rubric
- Self-improvement loop: max 3 revision cycles, threshold 8.6
- Client Input Required protocol (triggers if score < 8.6 after 3 cycles)
- Output delimiters: <<<GRANT_BODY_BEGIN>>> and <<<QA_REPORT_BEGIN>>>
- ABSOLUTE PROHIBITION: never invent, estimate, or extrapolate
  any statistic, figure, or fact not in the intake form or
  a verified web source

Minimum acceptable quality score before delivery: 8.6 / 10
Sub-threshold grants must NOT be delivered — trigger
Client Input Required report instead.

---

## Environment Variables

All secrets in .env (gitignored). Never log or print any key. No new
secrets are required for the Stage 1 pilot — Stage 0's Google Ads /
Carrd / Google Form accounts are Emily's own logins, not app secrets.

| Variable | Purpose | Where to find it |
|---|---|---|
| ANTHROPIC_API_KEY | Claude API | console.anthropic.com → API Keys |
| STRIPE_SECRET_KEY | Stripe payments | Stripe Dashboard → Developers → API Keys |
| STRIPE_WEBHOOK_SECRET | Webhook verification | stripe listen output (local) / Stripe Dashboard → Webhooks (prod) |
| RESEND_API_KEY | Email sending | resend.com → API Keys |
| GOOGLE_CLIENT_ID | Google OAuth | Google Cloud Console → Credentials |
| GOOGLE_CLIENT_SECRET | Google OAuth | Google Cloud Console → Credentials |
| GOOGLE_REFRESH_TOKEN | Google OAuth | Run get-google-token.js once |
| GOOGLE_DRIVE_FOLDER_ID | Root Drive folder | Google Drive URL when folder is open |
| ADMIN_PASSWORD | Dashboard auth | Set in .env — use locally too |
| DATABASE_URL | Postgres connection | Railway → Project → Postgres → Connect |
| APP_URL | Stripe redirect base | https://wellspringgrants.com (prod) / http://localhost:3000 (local) |
| PORT | Server port | Defaults to 3000 |

---

## Current Status (August 2026)

### Paid service — fully complete, live
- Intake form (all fields including EIN, signer, address)
- Stripe payment collection ($450 Checkout session) + webhook
- Confirmation, delivery, and admin-notification emails via Resend
- Grant generation engine (18 rules, 6-dimension scoring,
  self-improvement loop, QA report separation, delimiter parsing)
- Google Docs creation with full formatting pipeline
- Word document (.docx) delivery support
- Admin dashboard (2-panel layout, color-coded scores, status badges,
  collapsible detail view)
- Status lifecycle management
- FIRSTGRANT promo code, per-email use limit
- Global error handlers and /health endpoint
- Full payment → generation → delivery pipeline tested end-to-end in
  production with a real delivered grant

### Discovery site — nothing built yet
- [ ] Stage 0: paid-traffic validation test
- [ ] Stage 1: new DB tables
- [ ] Stage 1: pilot data curated (1 cause × 4–5 states)
- [ ] Stage 1: Astro pages built + email capture wired
- [ ] Stage 1: deployed, sitemap submitted to Search Console
- [ ] Decision gate (~8–10 weeks after launch)
- [ ] Stage 2: gated, do not start until decision gate clears

### Known Bugs (paid service)
1. createDoc.js:237 — footer ID bug
   fRes.data.replies[0].createFooter.headerId is always undefined
   (Google API returns footerId not headerId for createFooter)
   Fallback works so footers render — but dead code misleads debugging
   → TASKS.md NEW-C

2. Google Docs unicode index drift — createDoc.js:461
   Multi-byte characters (em dashes, smart quotes, accented letters)
   shift character indices and can misapply styling
   → Track in TASKS.md, fix when encountered in production

3. Google Doc subheading asterisks — fix deployed (commit 7f4e48c),
   needs one more real test submission to fully confirm resolved
   → see TASKS.md "Pending Verification"

---

## How to Work With Emily

### Her experience level
Comfortable with product decisions and concepts.
Beginner-to-intermediate with Claude Code.
Always explain what you are building and why before building it.
Never assume Emily knows what a file, pattern, or terminal
command does — explain it in plain language.

### Build workflow — always follow this order
1. Read all relevant files completely
2. Confirm you have read them (name each file)
3. List every change you plan to make and where
4. Wait for explicit confirmation: "confirmed" or "go"
5. Build
6. Show all changes with before/after context
7. Answer any confirmation questions asked
8. Update TASKS.md to mark the item complete

### Code change presentation
For every file changed, show:
- File name and line number(s) affected
- Old code (3 lines of context minimum)
- New code
Never do bulk silent find/replace across multiple files.

### Scope discipline
Only modify files explicitly named in the task.
If you need to touch a file not in scope: stop and ask.
Do not refactor, rename, or "improve" anything not asked for.
Do not add dependencies without asking first.
This applies equally to discovery-site work — e.g. adding the new
`POST /api/subscribe` route to server.js must be called out and shown
explicitly, not folded silently into an unrelated change.

### Destructive actions — always ask first
Never delete a file, drop a table, remove a route,
or overwrite production data without explicit confirmation.
Even if the task seems to imply it.

### Out-of-scope findings
If you find a bug or risk unrelated to the current task:
Label it clearly: ⚠️ OUT OF SCOPE FINDING
Describe it in 2 sentences.
Suggest adding it to TASKS.md.
Then continue with the current task without fixing it.

### Definition of done
A task is complete when:
1. Code is written and working
2. All changes shown with before/after
3. Confirmation questions answered
4. TASKS.md updated to [x] Complete

---

## Prompt Generation Partnership

When Emily describes a build task in plain language
and needs a prompt to send to a Claude Code session:

Before writing the prompt:
1. Check for ambiguity — what could be misinterpreted?
2. Check for missing context — what does Claude Code need
   to know that isn't stated?
3. Check for missing confirmation gates — where might
   Claude Code run ahead without stopping?
4. Identify which files are in scope

Then present:
- The complete copy-pasteable prompt
- A note on any risks or edge cases to watch for

If a task is too large for one prompt: say so and
suggest splitting it, with a recommended sequence.

---

## Pilot Readiness Checklist (REPLACES "Outreach Readiness Checklist")

This replaces the old cold-email outreach checklist, which assumed a
distribution model no longer in use.

Do NOT submit the sitemap to Google or spend ad budget beyond the
Stage 0 test until ALL of these are true:

- [ ] Stage 0 paid-traffic test run and reviewed — explicit decision made
      to proceed to Stage 1
- [ ] New discovery-site DB tables live; existing submissions/promo_codes
      tables verified untouched
- [ ] Pilot grant data manually verified — real, current application
      links, not just plausible-looking data
- [ ] Content floor enforced (5+ grants) on every generated page
- [ ] Email capture tested end-to-end (signup → row appears in
      subscribers table)
- [ ] Pages reviewed on localhost before deploy
- [ ] Google Search Console verified for the domain and sitemap ready to
      submit

---

## Monthly Cost Reference

| Service | Cost |
|---|---|
| Railway (app + Postgres) | ~$5–10/mo |
| Google Workspace | $6/mo |
| Anthropic API | ~$20–30/mo |
| Resend | Free tier (3k emails/mo) |
| Stripe | 2.9% + $0.30 per transaction |
| Namecheap domain | ~$1/mo amortized |
| Stage 0 ad test (one-time, not recurring) | ~$20–60 total |
| Discovery site hosting | $0 — served by existing Railway app |
| Google Search Console | $0 |
| **Total pre-revenue, steady state** | **~$60–75/mo** |

At $450/transaction, Stripe fee = ~$13.35
Net per grant at launch pricing: ~$436.65

---

## Critical Rules Summary

1. Never fabricate stats, figures, or facts in grant output — applies
   equally to discovery-site grant data
2. Never modify generateGrant.js prompt logic as a side effect
3. Never commit .env, .env.local, or credential JSON files
4. Never push to Railway without local test first
5. Never deliver a grant scoring below 8.6/10
6. Never start Chaos to Clarity until Wellspring hits $3k/mo for 6 weeks
7. Never reference Salesforce, Slack, or Emily's day job anywhere in
   the product
8. data/submissions.json: keep as backup only — do not delete until
   Postgres migration confirmed stable for 2+ weeks
9. Never modify the submissions or promo_codes tables/schema as a
   side effect of discovery-site work
10. Never generate a cause×state page below the 5-grant content floor
11. Never build Stage 2 automated ingestion/scraping/cron before the
    Stage 1 decision gate clears
12. Never expand Stage 0 ad spend beyond the agreed test budget without
    explicit approval
