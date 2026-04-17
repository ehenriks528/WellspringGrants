# Wellspring Grants — Claude Code Project Context
*Last updated: April 16, 2026*

---

## What This Project Is

Wellspring Grants is an AI-powered grant writing service 
for small nonprofits. Nonprofits pay $450, submit an intake 
form, and receive a professionally formatted, submission-ready 
grant application within 48 hours. The owner (Emily) does a 
20-minute quality review before delivery. The entire backend 
is automated — intake form → Stripe payment → Claude API 
grant generation → Google Docs creation → admin review → 
client delivery via email.

---

## Owner Context

Owner: Emily
Day job: Technical Project Manager (40–50 hrs/week)
Family: Two small children — time is extremely limited
Claude Code experience: Beginner, willing to learn on the job
Time available for Wellspring: 3–4 hours/week maximum
Priority at every decision point: automation over manual work
Personal constraint: This side hustle must NOT be visible 
to Salesforce colleagues — keep domain/branding fully separate

---

## Business Model

Pricing (launch — Months 1–3):
- Single grant application: $450
- Bundle of 3 applications: $1,100
- Monthly retainer (up to 4 apps/month): $1,400/month
- Rush delivery add-on: +$150

Pricing (standard — Month 4+):
- Single grant application: $600
- Bundle of 3 applications: $1,500
- Monthly retainer: $1,800/month

Promo code: FIRSTGRANT
- 100 uses max, expires 12 months from creation
- Bypasses Stripe entirely, routes directly to generation
- Tracks as is_comp: true in database

Target client: Small nonprofit EDs, annual budget $100k–$2M
Distribution: Cold email only — ProPublica Nonprofit Explorer
Zero social media. Zero LinkedIn. Zero Salesforce connections.

Second business (DO NOT BUILD YET):
"Chaos to Clarity" — AI-powered operations documentation 
for small businesses. Only start when Wellspring reaches 
$3k+/month consistently for 6+ consecutive weeks.
Keep entirely separate from this codebase forever.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend server | Node.js + Express (server.js) |
| Frontend | Vanilla HTML/CSS — no frameworks |
| AI engine | Anthropic claude-sonnet-4-6, 16k max tokens |
| Payments | Stripe Checkout + Webhook |
| Email | Resend API (sendEmail.js) |
| Documents | Google Docs API + Drive API (createDoc.js) |
| Database | Railway Postgres (db/queries.js) |
| Authentication | HTTP Basic Auth on all /admin routes |
| Hosting | Railway |
| Domain email | hello@wellspringgrants.com |

---

## File Map
WellspringGrants/
├── server.js              — all Express routes (497 lines)
├── generateGrant.js       — Claude API + 18-rule prompt engine
├── createDoc.js           — Google Docs formatting pipeline
├── sendEmail.js           — Resend confirmation + delivery emails
├── CLAUDE.md              — this file
├── TASKS.md               — full task list with status (28 tasks)
├── OPERATING_GUIDE.md     — complete owner manual (to be built)
├── RESEARCH.md            — comparison table research (to be built)
├── db/
│   ├── schema.sql         — Postgres table definitions
│   ├── queries.js         — all database functions
│   ├── migrate.js         — runs schema on fresh database
│   ├── seed.js            — loads 3 fixture submissions
│   └── import-existing.js — migrates old submissions.json
├── public/
│   ├── index.html         — marketing landing page (needs AI language audit)
│   ├── apply.html         — client intake form
│   ├── confirmation.html  — post-payment confirmation page
│   └── payment-cancelled.html
└── data/
└── submissions.json   — LEGACY flat file (keep as backup after Postgres migration)

---

## Current Status (April 2026)

### Fully Complete
- Intake form (all fields including EIN, signer, address)
- Stripe payment collection ($450 Checkout session)
- Confirmation email via Resend
- Grant generation engine (18 rules, 6-dimension scoring, 
  self-improvement loop, QA report separation, delimiter parsing)
- Google Docs creation with full formatting pipeline
- Admin dashboard (2-panel layout, color-coded scores, 
  status badges, collapsible detail view)
- Status lifecycle management
- TASKS.md (28 tasks, 7 marked complete)

### In Progress
- Postgres migration (replacing data/submissions.json) — Task 1
- Stripe webhook endpoint — Task NEW-A

### Not Started (see TASKS.md for full list)
Tasks 2–8, 10–12, 18–21, 24, NEW-B, NEW-C, NEW-D

### Known Bugs
1. createDoc.js:237 — footer ID bug
   fRes.data.replies[0].createFooter.headerId is always undefined
   (Google API returns footerId not headerId for createFooter)
   Fallback works so footers render — but dead code misleads debugging
   → TASKS.md NEW-C

2. No Stripe webhook endpoint (NEW-A in progress)
   Payment confirmation via browser redirect only
   Risk: client pays, browser crashes, submission stays pending_payment
   → TASKS.md NEW-A

3. Google Docs unicode index drift — createDoc.js:461
   Multi-byte characters (em dashes, smart quotes, accented letters) 
   shift character indices and can misapply styling
   → Track in TASKS.md, fix when encountered in production

4. File write race condition — generateGrant.js:374, server.js:38
   Read→modify→write on submissions.json not atomic
   Resolved by Postgres migration (Task 1)
   → TASKS.md NEW-B

---

## Grant Engine Rules — DO NOT MODIFY WITHOUT DISCUSSION

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

All secrets in .env (gitignored). Never log or print any key.

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

## Outreach Readiness Checklist

Do NOT begin cold email outreach until ALL of these are true:

- [ ] Railway Postgres live — data survives redeploys
- [ ] Stripe webhook endpoint working — no lost submissions
- [ ] Full payment → generation → delivery tested end-to-end
- [ ] FIRSTGRANT promo code live and tested
- [ ] At least 1 real grant delivered (even free) to a happy client
- [ ] Website has zero AI language above FAQ section
- [ ] Delivery email sends automatically on admin approval
- [ ] Admin can complete full review in under 20 minutes

Outreach method: Cold email to nonprofit EDs
Source: ProPublica Nonprofit Explorer (projects.propublica.org/nonprofits)
Filter: State, revenue $100k–$2M, ED email findable on website
Sequence: 3 emails over 2 weeks (see OPERATING_GUIDE.md)
Volume: 30/day from Gmail to start, upgrade to Instantly.ai at $37/mo
First emails go out the day after first free grant is confirmed delivered.

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
| Typeform (if still used) | $25/mo (or replace with custom form) |
| **Total pre-revenue** | **~$60–75/mo** |

At $450/transaction, Stripe fee = ~$13.35
Net per grant at launch pricing: ~$436.65

---

## Critical Rules Summary

1. Never fabricate stats, figures, or facts in grant output
2. Never modify generateGrant.js prompt logic as a side effect
3. Never commit .env, .env.local, or credential JSON files
4. Never push to Railway without local test first (once Task 3 done)
5. Never deliver a grant scoring below 8.6/10
6. Never start Chaos to Clarity until Wellspring hits $3k/mo for 6 weeks
7. Never reference Salesforce, Slack, or Emily's day job anywhere in the product
8. data/submissions.json: keep as backup only — do not delete until 
   Postgres migration confirmed stable for 2+ weeks
