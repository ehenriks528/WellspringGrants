# Wellspring Grants — Operating Guide
*Last updated: April 16, 2026*
*Owner: Emily — hello@wellspringgrants.com*

---

## Table of Contents

1. [What Is Wellspring Grants](#1-what-is-wellspring-grants)
2. [All Services and Where to Find Them](#2-all-services-and-where-to-find-them)
3. [Daily Operating Workflow](#3-daily-operating-workflow)
4. [Pricing and Promo Codes](#4-pricing-and-promo-codes)
5. [Environment Variables](#5-environment-variables)
6. [Deployment](#6-deployment)
7. [Local Development](#7-local-development)
8. [Troubleshooting](#8-troubleshooting)
9. [Client Communication Templates](#9-client-communication-templates)
10. [Outreach System — When and How](#10-outreach-system--when-and-how)
11. [Financial Tracking](#11-financial-tracking)
12. [90-Day Milestone Checklist](#12-90-day-milestone-checklist)

---

## 1. What Is Wellspring Grants

Wellspring Grants is an AI-assisted grant writing service for small nonprofits. A nonprofit fills out a 15-minute intake form describing their organization, their project, and the specific grant they're applying for. They pay $450. Within 48 hours, they receive a complete, funder-targeted grant application — all eight standard sections, formatted as a Google Doc or Word file — ready to submit. Every grant is scored on six quality dimensions and goes through a self-improvement loop before a human owner review. No calls, no back-and-forth, no waiting weeks.

**Business model in three points:**
- **Transaction revenue:** $450 per grant application at launch pricing (single, flat fee, no retainer required)
- **Automation-first:** intake → payment → generation → Google Doc → owner QA → delivery runs without manual work except the ~20-minute owner review
- **Owner's sole role in the workflow:** log into the admin dashboard, read the QA report, open the generated grant, verify it's accurate and specific to the client's organization, click "Create Google Doc," then click "Approve & Mark Delivered" — the system handles everything else

**The owner's 20-minute QA pass — what to check:**
1. Read the QA Report (right panel) — look for flagged gaps, low-confidence sections, or web-sourced claims marked 🌐
2. Read the grant body (left panel) — confirm the opening story is specific to this org, the statistics are real, no generic nonprofit language
3. If quality score is 8.6 or above and nothing looks fabricated: create the Google Doc and approve
4. If quality score is below 8.6: see Section 3.5 (Client Input Required workflow)

---

## 2. All Services and Where to Find Them

| Service | Purpose | URL | Login location | Monthly cost |
|---|---|---|---|---|
| Railway | App hosting + Postgres database | railway.app | Google SSO or email | ~$5–10 |
| Anthropic Console | Claude API (grant generation) | console.anthropic.com | Email/password | ~$20–30 (usage) |
| Stripe | Payment collection + webhooks | dashboard.stripe.com | Email/password | 2.9% + $0.30/txn |
| Resend | Transactional email sending | resend.com | Email/password | Free (≤3k/mo) |
| Google Cloud Console | Docs + Drive API credentials | console.cloud.google.com | Google account | Free |
| Google Drive | Client document storage (grant docs) | drive.google.com | Google account (hello@wellspringgrants.com) | Included in Workspace |
| Namecheap | Domain registration (wellspringgrants.com) | namecheap.com | Email/password | ~$1/mo amortized |
| Google Workspace | hello@wellspringgrants.com email | admin.google.com | Google account | $6/mo |
| ProPublica Nonprofit Explorer | Lead research — finding nonprofit EDs | projects.propublica.org/nonprofits | No login required | Free |
| Instantly.ai | Cold email sending at scale (add when ready) | instantly.ai | Email/password | $37/mo (when added) |

### Monthly Operating Costs at Launch

| Item | Cost |
|---|---|
| Railway (app + Postgres) | $10/mo |
| Google Workspace | $6/mo |
| Anthropic API (estimated) | $25/mo |
| Resend | $0/mo (free tier) |
| Namecheap domain | $1/mo |
| Stripe fees (at $450/grant) | $13.35/grant (variable) |
| **Total fixed monthly cost** | **$42/mo** |
| **Total at 1 grant/week** | **~$96/mo** |
| **Total at 4 grants/week** | **~$255/mo** |

*Stripe fees are per-transaction, not monthly. At $450/grant: 2.9% × $450 = $13.05 + $0.30 = $13.35. Net per grant: $436.65.*

---

## 3. Daily Operating Workflow

### 3.1 — Checking for new submissions

**Where to look:** Log into the admin dashboard at `https://wellspringgrants.com/admin` (or `http://localhost:3000/admin` locally). Username: `admin`. Password: your `ADMIN_PASSWORD` from Railway environment variables.

**Status meanings and required actions:**

| Status | What it means | What to do |
|---|---|---|
| `Awaiting Payment` | Form submitted, Stripe not completed | No action — client may still pay. Wait 24 hrs then disregard. |
| `Generating...` | Claude API is writing the grant right now | Wait — do not click anything. Check back in 5–10 minutes. |
| `Draft Ready` | Grant generated, scored ≥ 8.6, awaiting your review | **Action required** — open and review within 48 hrs of submission |
| `Client Input Required` | Grant scored below 8.6 after 3 revision cycles | **Action required** — send the gap questions to the client |
| `Generation Failed` | Claude API error during generation | See Troubleshooting Section 8 |
| `Delivered` | Approved and delivery email sent | No action |

**Daily check habit:** Open the admin dashboard once in the morning. Look for any `Draft Ready` or `Client Input Required` rows — those are the only statuses that require your attention.

---

### 3.2 — Reviewing a generated grant

1. From the admin dashboard, click **View →** on any `Draft Ready` submission
2. The detail page loads with a two-panel layout:
   - **Left panel:** The client-ready grant body — exactly what the client will see
   - **Right panel:** The internal QA Report — your working notes, never sent to the client

**Quality score:** Displayed as a number out of 10 in the left panel score box.
- **8.6 or above (green):** Cleared the threshold — safe to approve
- **Below 8.6 (red):** Did not clear — should not be delivered as-is. Check the QA Report for gap questions.

**Reading the QA Report:**
- `GAP [N]` entries describe what information was missing or thin
- `🌐 WEB-SOURCED` flags mark claims pulled from public web sources — verify these are accurate before approving
- `CLIENT INPUT REQUIRED` at the top means the engine couldn't reach 8.6 even after 3 self-improvement cycles

**What to look for in the grant body:**
- Does the opening paragraph tell a specific story about this nonprofit's actual work? (Not generic — no "every year, millions of families...")
- Are all statistics real and traceable to the intake form or a cited web source?
- Is the organization name used correctly and consistently throughout?
- Does the budget narrative match the `budget_breakdown` the client provided?
- Does the funder name and grant program appear correctly on the cover?

**When to approve:** Score is 8.6+, grant body reads specific and compelling, no fabricated figures.

**When to send client input request:** Score is below 8.6, or you spot a fabricated statistic, or the intake data was too thin for the section to be credible. See Section 3.5.

---

### 3.3 — Creating the Google Doc

The Google Doc must be created before you can approve and deliver. It creates a formatted version of the grant in the client's shared Google Drive folder.

1. On the submission detail page, scroll down to the left panel
2. Click **"Create Google Doc →"**
3. Wait 10–30 seconds — the page will reload with a green "Open Google Doc ↗" link when complete
4. Click "Open Google Doc ↗" to verify the formatting before approving:
   - Cover page has org name, funder name, grant program, date
   - Section headers are bold and formatted correctly
   - Budget table has a totals row
   - Footer shows org name and page numbers on every page after the cover

**If Google Doc creation fails:**
- The error message will appear on the page — read it carefully
- Most common cause: expired Google OAuth refresh token. Fix: re-run `get-google-token.js` locally and update `GOOGLE_REFRESH_TOKEN` in Railway environment variables
- Second most common: `GOOGLE_DRIVE_FOLDER_ID` is wrong or the service account lost access to the folder. Check Drive sharing settings.
- After fixing the root cause: reload the submission page and click "Create Google Doc →" again — it is safe to retry

---

### 3.4 — Approving and delivering

Once you've reviewed the grant and the Google Doc looks correct:

1. On the submission detail page, click **"Approve & Mark Delivered"** (blue button, left panel)
2. The button changes to "Delivering…" while the request processes
3. On success, the button becomes a gray **"✓ Delivered [date]"** label — it cannot be clicked again
4. The system automatically:
   - Updates the submission status to `delivered`
   - Sends the client a delivery email containing the Google Doc link, a summary box, next steps, and a pre-submission checklist

**What the client receives:** An email from `hello@wellspringgrants.com` with the subject "Your Grant Application Is Ready — [Org Name]." It contains a green "Open Your Grant Application →" button, the application summary, three numbered next steps, and a "Before You Submit" checklist (EIN, 501(c)(3) letter, Form 990).

**If the delivery email fails to send:**
- A browser alert will appear: "Marked as delivered, but the delivery email failed to send. Please email the client manually."
- The submission is still marked `delivered` in the database — do not click again
- Copy the Google Doc link from the submission detail page and email it manually from `hello@wellspringgrants.com` using template 9.1 adapted for delivery

---

### 3.5 — Handling a "Client Input Required" submission

**What it means:** Claude generated the grant but couldn't reach a quality score of 8.6 / 10 after three full revision cycles. The intake data wasn't detailed enough for one or more sections to be credible. The grant should not be delivered as-is.

**How to read the GAP report (right panel):**
Each `GAP [N]` entry has three parts:
- **What's missing** — the specific information the engine couldn't find
- **Why it matters** — which quality dimension this affected and why funders care
- **What to ask** — the exact question(s) to send the client

**What to do:**
1. Read all the GAP entries
2. Compose an email to the client (use template 9.1 adapted for gap follow-up, or adapt the auto-generated follow-up from the QA report)
3. Ask only the specific questions listed in the GAP entries — do not ask for a full re-intake
4. When the client responds, forward their answers to `hello@wellspringgrants.com` as context and re-trigger generation (currently manual — re-submit via admin or wait for Task 20 revision flow)

**Timeline expectation:** Contact the client within 24 hours of the submission appearing in `Client Input Required`. Tell them you need 2–3 specific details and you'll have the grant to them within 24 hours of their response.

---

## 4. Pricing and Promo Codes

### Current pricing structure

| Tier | Price | Status |
|---|---|---|
| Single grant application | $450 | Active — launch pricing |
| Bundle of 3 applications | $1,100 | Planned — not yet in Stripe |
| Monthly retainer (up to 4 apps/mo) | $1,400/mo | Planned — not yet in Stripe |
| Rush delivery add-on | +$150 | Planned |
| Single grant (Month 4+) | $600 | Future — do not discuss with clients yet |

### How promo codes work

When a client enters a valid promo code on the intake form:
1. The form validates the code against the database on blur (real-time feedback)
2. The price display updates to "Complimentary ($0)"
3. On form submit, the server independently validates the code — the frontend result is never trusted
4. If valid: Stripe is bypassed entirely. The submission is marked `is_comp: true`, the code's usage counter is incremented, and grant generation fires immediately
5. The admin dashboard shows a **COMP** badge on the submission row and a "Complimentary" stat box in the header

### How to check promo code usage

Connect to the Railway Postgres database and run:
```sql
SELECT code, times_used, max_uses, expires_at, is_active
FROM promo_codes
ORDER BY created_at DESC;
```

Or check Railway: Railway Dashboard → your project → Postgres service → Data tab → promo_codes table.

### How to create a new promo code

Option A — via npm script (when a seed helper is added):
```bash
node -e "require('./db/queries').createPromoCode('NEWCODE', 'Description', 100, 365)"
```
Arguments: `(code, description, maxUses, expiryDays)`. Pass `null` for expiryDays for no expiry.

Option B — directly in Postgres:
```sql
INSERT INTO promo_codes (code, description, max_uses, expires_at)
VALUES ('NEWCODE', 'Description here', 50, NOW() + interval '6 months');
```

### FIRSTGRANT code — current status

- **Code:** `FIRSTGRANT`
- **Max uses:** 100
- **Expiry:** 12 months from the date `npm run migrate` was last run on a fresh database
- **Purpose:** First grant free — used in cold email outreach to acquire first clients
- **Seeded by:** `db/schema.sql` — runs automatically on `npm run migrate`
- **To check remaining uses:** Run the SQL above or check Railway Data tab

---

## 5. Environment Variables

All secrets live in `.env` (production, managed in Railway) and `.env.local` (local development only, never committed). Never log or print any of these values.

| Variable | What it is | Where to find it | Required? |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Railway → Project → Postgres service → Connect tab → "Postgres Connection URL" | Yes |
| `STRIPE_SECRET_KEY` | Stripe API key for creating checkout sessions | Stripe Dashboard → Developers → API Keys → "Secret key" (starts with `sk_live_` in prod, `sk_test_` locally) | Yes |
| `STRIPE_WEBHOOK_SECRET` | Verifies that webhook events are really from Stripe | **Local:** `stripe listen` output — printed as "Your webhook signing secret is whsec_..." · **Production:** Stripe Dashboard → Developers → Webhooks → click your endpoint → "Signing secret" | Yes |
| `APP_URL` | Base URL for Stripe redirect links | `https://wellspringgrants.com` in production · `http://localhost:3000` locally | Yes |
| `ADMIN_PASSWORD` | Password for the `/admin` dashboard HTTP Basic Auth | Set this yourself — store it in your password manager | Yes |
| `ANTHROPIC_API_KEY` | Claude API key for grant generation | console.anthropic.com → API Keys → create or copy existing (starts with `sk-ant-`) | Yes |
| `RESEND_API_KEY` | Resend API key for sending transactional emails | resend.com → API Keys → create key with "Sending access" (starts with `re_`) | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for Docs/Drive API | Google Cloud Console → Credentials → OAuth 2.0 Client IDs → copy "Client ID" | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Google Cloud Console → Credentials → OAuth 2.0 Client IDs → copy "Client Secret" | Yes |
| `GOOGLE_REFRESH_TOKEN` | Long-lived token granting Docs/Drive access | Run `get-google-token.js` locally once after setting Client ID/Secret — printed to console | Yes |
| `GOOGLE_DRIVE_FOLDER_ID` | ID of the root Google Drive folder where client docs are stored | Open the folder in Google Drive → copy the long ID from the URL (`drive.google.com/drive/folders/THIS_PART`) | Yes |
| `PORT` | Server port | Defaults to 3000 — Railway sets this automatically, do not set manually in production | No |

**Setting variables in Railway:**
Railway Dashboard → your project → the app service (not Postgres) → Variables tab → "New Variable" → paste name and value → Deploy.

---

## 6. Deployment

### How to deploy a code change to Railway

Railway auto-deploys from your connected GitHub repository on every push to the main branch. Standard workflow:

```bash
git add <changed files>
git commit -m "Description of change"
git push origin main
```

Railway detects the push, builds a new container, and deploys it. Watch the deployment in Railway Dashboard → your project → Deployments tab.

**If Railway is not connected to GitHub:** Go to Railway Dashboard → your project → Settings → Source → connect your GitHub repo.

### How to check Railway logs for errors

Railway Dashboard → your project → the app service → Logs tab. Logs are streaming and searchable. Look for lines beginning with `Error`, `Failed`, or `Webhook`.

For Postgres logs: Railway Dashboard → Postgres service → Logs tab.

### How to rollback a bad deploy

Railway Dashboard → your project → Deployments tab → find the last working deployment → click the three-dot menu → "Rollback." Railway instantly rolls back to that container.

After rollback, investigate the bad change locally before re-deploying.

### How to run the seed script after a database reset

If you ever reset the Postgres database (or provision a new one), run migrations and seed in this order:

```bash
# In production (Railway Postgres)
npm run migrate      # Creates tables + seeds FIRSTGRANT promo code
npm run seed:prod    # Loads 3 fixture submissions for testing

# Locally
npm run migrate
npm run seed         # Uses .env.local for DATABASE_URL
```

**Warning:** `npm run seed:prod` uses the `.env` file (Railway Postgres). Only run it if you want fixture data in your production database. The fixtures use stable IDs (`fixture-bright-futures-001`, etc.) so re-running skips already-inserted records.

### What to do if Railway goes down

1. Check Railway status page: status.railway.app
2. If Railway is degraded, there is nothing to do — wait for recovery
3. If only your service is down (not Railway itself):
   - Check Logs tab for crash reason
   - Most common causes: missing environment variable, syntax error in a recent deploy, Postgres connection failure
   - Fix the root cause, push a fix commit, or rollback (see above)
4. Any submissions that came in during downtime will be in the database — no data loss with Postgres

---

## 7. Local Development

### Starting the local dev server

```bash
# One-time setup — install dependencies
npm install

# Copy the local env template and fill in values
cp .env.local.example .env.local
# Edit .env.local — replace all REPLACE_ME values

# Run database migrations (one-time, or after schema changes)
npm run migrate

# Load fixture submissions (optional)
npm run seed

# Start the server with hot-reload
npm run dev:watch

# Or start without hot-reload
npm run dev
```

Server runs at `http://localhost:3000`. Admin dashboard: `http://localhost:3000/admin`.

### How to run Stripe CLI for webhook testing

Stripe webhooks require the Stripe CLI to forward events to your local server. In a separate terminal:

```bash
# One-time login
stripe login

# Forward Stripe events to your local webhook endpoint
stripe listen --forward-to localhost:3000/webhook
```

The CLI prints your local webhook signing secret (`whsec_...`). Copy it into `.env.local` as `STRIPE_WEBHOOK_SECRET`. Leave this terminal running while you test.

**To simulate a completed payment:**
```bash
stripe trigger checkout.session.completed
```

This fires a real webhook event to your local server. Check the server terminal for `Webhook: generation triggered for [id]`.

### How to seed the local database

```bash
npm run seed
```

Inserts three fixture submissions (see `db/seed.js`):
- **Bright Futures Learning Center** — `draft_ready`, quality score 8.9 — use to test Google Doc creation and delivery
- **Riverside Youth Arts Collective** — `pending_payment` — use to test the Awaiting Payment state
- **Green Valley Food Pantry** — `input_required`, quality score 7.2, client input required — use to test the GAP workflow

Re-running seed is safe — it skips records that already exist.

### How to test the full payment → generation → doc creation flow locally

1. Start `npm run dev:watch` in terminal 1
2. Start `stripe listen --forward-to localhost:3000/webhook` in terminal 2
3. Open `http://localhost:3000/apply` in the browser
4. Fill out the intake form — use any realistic nonprofit data
5. On the Stripe checkout page, use test card `4242 4242 4242 4242`, any future expiry, any CVC
6. After payment, watch terminal 1 for `Webhook: generation triggered for [id]`
7. Generation takes 1–5 minutes. Refresh the admin dashboard at `http://localhost:3000/admin`
8. When status changes to `draft_ready`, open the submission → review → Create Google Doc → Approve & Mark Delivered
9. Check the email inbox for `contact_email` you used — delivery email should arrive

**To test the promo code path:** Enter `FIRSTGRANT` in the promo code field on the intake form. The price display should update to "Complimentary ($0)" and the form should bypass Stripe entirely on submit.

---

## 8. Troubleshooting

### Grant stuck in "Generating" status

**Symptom:** Submission has been in `Generating...` for more than 15 minutes.

**Likely causes:**
- Claude API call timed out or hit a rate limit
- Unhandled exception in `generateGrant.js` that didn't update the status

**Fix:**
1. Check Railway logs for the error. Search for the submission ID.
2. If you see `Generation failed: [id]` — the status should have been updated to `generation_failed`. If it's still `generating`, the process crashed before the error handler ran.
3. In Postgres: `UPDATE submissions SET status = 'generation_failed' WHERE id = '[id]' AND status = 'generating';`
4. Then re-trigger generation by updating status back to `paid` and restarting the server — or wait for the revision flow (Task 20) to be built.

---

### Google Doc creation failed

**Symptom:** Error message appears on the submission detail page when clicking "Create Google Doc →".

**Likely causes and fixes:**

| Error message contains | Cause | Fix |
|---|---|---|
| `invalid_grant` or `Token has been expired` | Google OAuth refresh token expired | Re-run `get-google-token.js` locally, copy new token to `GOOGLE_REFRESH_TOKEN` in Railway |
| `insufficientPermissions` | Service account lost access to Drive folder | Open Google Drive folder → Share → confirm `hello@wellspringgrants.com` has Editor access |
| `GOOGLE_DRIVE_FOLDER_ID` missing | Env var not set | Add `GOOGLE_DRIVE_FOLDER_ID` to Railway environment variables |
| `429` or `quota` | Google API quota exceeded | Wait 60 seconds and retry |

---

### Client never received confirmation email

**Symptom:** Client paid, submission shows `Generating...` or `Draft Ready`, but client says they got no email.

**Likely causes:**
1. `RESEND_API_KEY` is missing or wrong — check Railway variables
2. Email went to spam — ask the client to check
3. `contact_email` was entered incorrectly in the intake form — check the admin submission detail page

**Fix:** Check Railway logs for `Email failed for [email]`. If the API key is correct and the address is right, resend manually from `hello@wellspringgrants.com`.

---

### Stripe webhook not firing

**Symptom:** Client paid (Stripe shows payment completed), but submission stays in `pending_payment` and generation never starts.

**Likely causes:**
1. `STRIPE_WEBHOOK_SECRET` in Railway doesn't match the endpoint's signing secret
2. The webhook endpoint isn't registered in Stripe Dashboard for production
3. Locally: Stripe CLI isn't running

**Fix (production):**
1. Stripe Dashboard → Developers → Webhooks → confirm endpoint `https://wellspringgrants.com/webhook` exists
2. Click the endpoint → copy "Signing secret" → confirm it matches `STRIPE_WEBHOOK_SECRET` in Railway
3. Check "Recent deliveries" on that endpoint for failed events — you can replay them

**Fix (local):** Ensure `stripe listen --forward-to localhost:3000/webhook` is running in a separate terminal.

---

### Railway deploy wiped the database

**Symptom:** Admin dashboard shows no submissions after a Railway redeploy.

**What happened:** Railway Postgres data is persistent — a redeploy of the *app service* never touches the database. If submissions are gone, one of these happened:
- You reset or deleted the Postgres service in Railway
- A migration ran `DROP TABLE` instead of `CREATE TABLE IF NOT EXISTS`
- You're accidentally pointing at a different database (check `DATABASE_URL`)

**Recovery:**
1. Confirm `DATABASE_URL` in Railway points to the correct Postgres service
2. If the database was reset: `npm run migrate` then `npm run seed:prod` for fixtures
3. If there were real submissions: check if `data/submissions.json` still exists as a backup, then run `npm run import` to re-import

---

### Admin dashboard shows no submissions

**Symptom:** Dashboard loads but shows "No submissions yet."

**Likely causes:**
1. `DATABASE_URL` is pointing at the wrong database (local vs production)
2. Tables don't exist yet — migration hasn't been run
3. Postgres service is down

**Fix:**
1. Check Railway logs for database connection errors
2. Confirm `DATABASE_URL` is set in Railway environment variables
3. Run `npm run migrate` if tables are missing

---

### Quality score never reaches 8.6

**Symptom:** Grant goes to `input_required` for every submission even when intake data seems complete.

**Likely causes:**
1. Intake form missing key fields — problem statement, target population, expected outcomes, or budget breakdown were left vague
2. The funder guidelines URL was invalid or inaccessible — the engine couldn't tailor to the specific program
3. A scoring dimension has a systematic issue in the prompt engine

**Fix:**
1. Check the QA Report — look at which dimensions scored lowest (below 7.0)
2. If it's consistently `Funder Alignment`: the guidelines URL fetch may be failing. Check logs for fetch errors.
3. If it's consistently `Evidence`: the intake form's problem statement or expected outcomes fields need more required guidance — consider adding placeholder text to the form

---

### Client says grant doesn't match their organization

**Symptom:** Client reviews delivered grant and reports inaccurate details.

**Immediate response:**
1. Apologize briefly and ask them to forward the specific inaccuracies
2. Open the admin submission detail page — check whether the error originated in the intake form (client entered wrong data) or in the generated text
3. If it was a generation error: fix it manually in the Google Doc — do not re-run generation
4. If it was intake form data entered incorrectly by the client: correct it in the doc and note the source of the error in your reply

**Prevention:** The QA review in Section 3.2 exists specifically to catch this before delivery. Always verify organization name, EIN, city, mission statement, and program name before approving.

---

## 9. Client Communication Templates

### 9.1 — Response to inbound inquiry

*Use when someone emails hello@wellspringgrants.com asking about the service.*

> Subject: Re: Grant Writing Inquiry
>
> Hi [Name],
>
> Thanks for reaching out. Wellspring Grants writes complete, funder-targeted grant applications for small nonprofits — delivered within 48 hours, starting at $450.
>
> Here's how it works: you fill out a 15-minute intake form about your organization and the specific grant you're applying for. We write the full application — all eight standard sections — and deliver it as a Google Doc or Word file, ready to submit.
>
> If you're ready to start, you can submit your intake form here: wellspringgrants.com/apply
>
> If you have questions before getting started, happy to answer them.
>
> Emily
> Wellspring Grants
> hello@wellspringgrants.com

---

### 9.2 — Following up after a grant is delivered

*Send 5–7 days after delivery to check in on the submission.*

> Subject: Quick check-in — [Funder Name] application
>
> Hi [First Name],
>
> Just checking in on the [Grant Program] application we delivered last week. Were you able to review it? Any questions before you submit?
>
> If anything needs adjusting, just reply and I'll take care of it.
>
> Emily
> Wellspring Grants

---

### 9.3 — Requesting a referral after a funded grant

*Send after the client confirms a funded grant. Timing: within 48 hours of hearing the news.*

> Subject: Congratulations on the [Funder Name] grant!
>
> Hi [First Name],
>
> Congratulations — that's a fantastic result. Well done on putting together such a strong submission.
>
> We love hearing when an application lands. If you know any other small nonprofit EDs who are working on grants and could use this kind of support, we'd genuinely appreciate an introduction. We're selective about growth and work best with organizations like yours — mission-driven, under $2M budget, community-focused.
>
> Either way, it's been a pleasure working with [Org Name]. We'd love to help with your next application whenever you're ready.
>
> Emily
> Wellspring Grants

---

### 9.4 — Retainer conversion pitch after first successful delivery

*Send 2–3 weeks after delivery, after the client has had time to experience the process.*

> Subject: [Org Name] — upcoming grant deadlines?
>
> Hi [First Name],
>
> Hope the [Funder Name] application went smoothly. I wanted to reach out about something that might save you a lot of time this year.
>
> We offer a monthly retainer for nonprofits managing multiple grant deadlines — $1,400/month for up to four applications. At your current volume, that's significantly less per grant than the single-application rate, and it means you always have capacity reserved when a deadline comes up.
>
> If you have upcoming deadlines in the next 60–90 days, it might be worth a quick conversation. Reply here and we can look at your calendar together.
>
> Emily
> Wellspring Grants

---

### 9.5 — Handling a complaint or unhappy client

*Use when a client is dissatisfied — inaccurate content, late delivery, or anything negative.*

> Subject: Re: [Subject of their complaint]
>
> Hi [First Name],
>
> Thank you for letting me know — I take this seriously and I want to make it right.
>
> [If content error:] I've reviewed the application and I can see the issue with [specific section]. I'm fixing it now and will have a corrected version to you within [2–4 hours / end of today].
>
> [If late delivery:] I apologize for the delay. This fell outside our standard turnaround and that's not acceptable. Your revised application will be in your inbox by [specific time].
>
> [If general dissatisfaction:] Can you tell me specifically which sections or details didn't read accurately? I want to understand exactly what needs to be corrected so I can address it properly, not just generally.
>
> I'll be in touch shortly.
>
> Emily
> Wellspring Grants

*Principle: respond within 4 hours of any complaint. Never be defensive. Offer a specific fix with a specific time, not a vague promise.*

---

## 10. Outreach System — When and How

### 10.1 — When to start outreach (readiness checklist)

Do NOT begin cold email outreach until every item below is checked:

- [ ] Railway Postgres is live and data survives redeployments (run a test deploy and confirm submissions persist)
- [ ] Full payment → generation → doc creation → delivery flow tested end-to-end at least once with real Stripe test money
- [ ] At least 1 free grant delivered via FIRSTGRANT promo code to a real nonprofit, and client confirmed they're happy with it
- [ ] Website has zero AI language above the FAQ section (landing page audit complete)
- [ ] `hello@wellspringgrants.com` confirmed sending (send a test email to yourself and verify it arrives without going to spam)
- [ ] Admin can complete full review and delivery in under 20 minutes from receiving a `Draft Ready` notification
- [ ] FIRSTGRANT promo code is seeded in the production database, tested, and confirmed to bypass Stripe correctly

**First outreach goes out the day after the first free grant is confirmed delivered and the client is satisfied.**

---

### 10.2 — How to build the prospect list

**Source:** ProPublica Nonprofit Explorer — `projects.propublica.org/nonprofits`

**Filters to use:**
1. Go to the search page
2. Select your target **State** (start with one state — Texas or California are large markets)
3. Revenue range: set minimum $100,000 and maximum $2,000,000
4. NTEE code: filter by program area if you want to target a specific sector (education, food security, arts, etc.)
5. Click through to individual organization pages — each shows the ED name from the most recent 990 filing

**Finding the ED email:**
1. From the ProPublica page, go to the nonprofit's website (listed in the 990 data)
2. Look for the "About" or "Team" page — ED email is usually listed
3. If not on the website: try `[firstname]@[domain]` or `[firstinitial][lastname]@[domain]` — both are common patterns for small nonprofits
4. If you can't find it in 3 minutes, skip and move to the next org — don't spend time hunting

**Tracking:** Add each prospect to a Google Sheet (see Section 10.5).

---

### 10.3 — Cold email sequence

Three emails over two weeks. Send from `hello@wellspringgrants.com`.

---

**Email 1 — Day 0 (initial outreach)**

> Subject: Grant writing for [Org Name] — 48-hour turnaround
>
> Hi [First Name],
>
> I came across [Org Name] on ProPublica and wanted to reach out. I run Wellspring Grants — we write complete, funder-targeted grant applications for small nonprofits in 48 hours, starting at $450.
>
> Most of our clients are EDs managing multiple program responsibilities who don't have time to write grant applications from scratch — or budget for a full-time grant writer.
>
> If you have an upcoming deadline, I'd be glad to send you a free sample application so you can see the quality before committing to anything. Just reply with the grant you're working on and I'll put one together.
>
> Emily
> Wellspring Grants
> wellspringgrants.com

---

**Email 2 — Day 5 (follow-up)**

> Subject: Re: Grant writing for [Org Name]
>
> Hi [First Name],
>
> Just following up on my note from earlier this week. I know your inbox is full — no pressure at all.
>
> If you're not working on any foundation grants right now, no worries. If you are — or have one coming up in the next 60 days — I'd genuinely like to help. First application is on us with promo code FIRSTGRANT at checkout.
>
> wellspringgrants.com/apply
>
> Emily

---

**Email 3 — Day 12 (final)**

> Subject: Last note — Wellspring Grants
>
> Hi [First Name],
>
> Last note from me. If the timing isn't right, I completely understand.
>
> If you ever have a grant deadline coming up and need a complete, polished application fast — wellspringgrants.com is where to start. First grant is free with code FIRSTGRANT.
>
> Wishing [Org Name] a strong year.
>
> Emily

---

### 10.4 — Volume and sending rules

- **Maximum per day from Gmail:** 30 cold emails. Gmail's daily sending limit is 500, but 30/day keeps your domain reputation clean at launch.
- **Upgrade to Instantly.ai** when: you're ready to scale above 30/day and your domain has been warmed for at least 4 weeks ($37/month — see Section 2 cost table)
- **Send schedule:** Monday through Thursday only. Do not send cold emails on Friday afternoon or weekends — response rates drop significantly.
- **Gap between sequences:** Wait at least 3 days between Email 1 and Email 2, 7 days between Email 2 and Email 3. The sequence is 12 days total.
- **Domain warm-up:** For the first two weeks of outreach, send 10/day. Week 3+: increase to 30/day. This protects `wellspringgrants.com` deliverability.

---

### 10.5 — Tracking responses

**Tool:** Google Sheet. Create one tab titled "Outreach — [Month Year]".

**Columns:**

| Column | What to put there |
|---|---|
| Org Name | Full legal name from ProPublica |
| ED Name | First and last name |
| Email | The email address you're sending to |
| Website | Their website URL |
| Revenue | Annual revenue from ProPublica (approximate) |
| State | State |
| Date Email 1 Sent | Date |
| Date Email 2 Sent | Date (leave blank until sent) |
| Date Email 3 Sent | Date (leave blank until sent) |
| Status | See status values below |
| Notes | Anything relevant |

**Status values:**

| Status | Meaning |
|---|---|
| `Sent` | Email 1 delivered, no response yet |
| `Seq: E2` | Email 2 sent, awaiting response |
| `Seq: E3` | Email 3 sent, sequence complete |
| `Responded` | They replied — take it out of the sequence |
| `Not interested` | Replied with a no — do not contact again |
| `Applied` | Used FIRSTGRANT or paid — move to client tracking |
| `Skip` | Couldn't find email, org isn't a fit, etc. |

**When to follow up:** Only through the automated 3-email sequence. Do not send a 4th email. If they haven't responded after Email 3, move to `Seq: E3` and leave them alone.

---

## 11. Financial Tracking

### How to find revenue in Stripe Dashboard

Stripe Dashboard → Payments → Transactions. Filter by date range. Each row shows amount, status, and the customer email. Click any transaction to see metadata — the `submissionId` is stored there and links back to the database record.

**Monthly revenue:** Stripe Dashboard → Reports → Revenue. Or filter Payments by month and sum the amounts manually.

### How to identify comp'd vs paid submissions

In the admin dashboard, comp'd submissions show a green **COMP** badge. The "Complimentary" stat box in the dashboard header counts them.

In Postgres:
```sql
SELECT org_name, contact_email, submitted_at, is_comp, promo_code_used, amount_requested
FROM submissions
WHERE status = 'delivered'
ORDER BY submitted_at DESC;
```

### Monthly revenue calculation

At $450/grant with Stripe fees:
- Gross per grant: $450.00
- Stripe fee: $450 × 2.9% + $0.30 = $13.05 + $0.30 = **$13.35**
- Net per grant: **$436.65**

Monthly net at various volumes:

| Grants/month | Gross | Stripe fees | Net | Minus fixed costs (~$42) |
|---|---|---|---|---|
| 2 | $900 | $26.70 | $873.30 | $831.30 |
| 5 | $2,250 | $66.75 | $2,183.25 | $2,141.25 |
| 10 | $4,500 | $133.50 | $4,366.50 | $4,324.50 |

Comp'd grants (FIRSTGRANT) generate $0 revenue and are not included in Stripe revenue reports. Track them separately in Postgres with the `is_comp` filter.

### Stripe fee calculation (for any amount)

`Fee = (amount × 0.029) + 0.30`

Examples: $450 → $13.35 · $600 → $17.70 · $1,100 → $32.20

---

## 12. 90-Day Milestone Checklist

### Month 1 targets (Days 1–30)

- [ ] Railway Postgres live and tested
- [ ] Stripe webhook confirmed working in production
- [ ] Full end-to-end test completed (form → payment → generation → delivery)
- [ ] FIRSTGRANT promo code live and tested
- [ ] Website AI language fully removed
- [ ] Admin can deliver a grant in under 20 minutes
- [ ] Cold outreach started: 30 emails/day to nonprofit EDs
- [ ] First 1–3 free grants delivered (FIRSTGRANT)
- [ ] First paid submission received
- [ ] 0 catastrophic failures (lost data, double charges, undelivered grants)

**Month 1 income target:** $450–$900 (1–2 paid grants)
**Primary goal:** Prove the pipeline works end-to-end with real clients.

---

### Month 2 targets (Days 31–60)

- [ ] 5+ grants delivered total (free + paid)
- [ ] At least 2 paid grants at $450
- [ ] First client referral received (or actively requested — see template 9.3)
- [ ] Retainer pitch sent to at least 1 happy client (template 9.4)
- [ ] Google Sheet tracking all outreach prospects
- [ ] Response rate benchmarked (target: 5–10% open-to-reply rate on cold sequence)
- [ ] Comparison table on website live (Task 7 + 8 complete)
- [ ] Revision flow working (client can request edits — Task 20)

**Month 2 income target:** $1,350–$2,250 (3–5 paid grants)
**Primary goal:** Establish repeatable client acquisition and delivery. First retainer conversion attempted.

---

### Month 3 targets (Days 61–90)

- [ ] $3,000+ gross revenue in the month
- [ ] At least 1 retainer client signed ($1,400/month)
- [ ] 10+ total grants delivered
- [ ] NPS or informal satisfaction feedback collected from every client
- [ ] No unresolved client complaints
- [ ] All TASKS.md critical items marked complete
- [ ] Operating fully within 3–4 hours/week owner time
- [ ] Outreach scaled — either Instantly.ai added or Gmail volume optimized

**Month 3 income target:** $3,000–$4,500 (6–10 paid grants, or 1 retainer + 4 singles)

---

### Income projection summary

| Month | Target grants | Gross revenue | Net after fees + costs |
|---|---|---|---|
| Month 1 | 1–2 paid | $450–$900 | $390–$830 |
| Month 2 | 3–5 paid | $1,350–$2,250 | $1,230–$2,100 |
| Month 3 | 6–10 paid | $2,700–$4,500 | $2,560–$4,320 |

---

### Trigger conditions for adding Chaos to Clarity

Do NOT build or promote the second business until ALL of these are true for **six consecutive weeks**:

- [ ] Wellspring Grants is generating $3,000+ gross/month consistently
- [ ] Owner time is under 4 hours/week on Wellspring (pipeline is truly automated)
- [ ] No open client issues or unresolved quality problems
- [ ] At least one retainer client is active and stable
- [ ] You have documented the Wellspring operating playbook well enough that someone else could run it

**What Chaos to Clarity is:** AI-powered operations documentation service for small businesses. Kept entirely separate from Wellspring codebase, branding, and domain. Do not build anything for it in this repo — ever.

---

*Wellspring Grants — Internal Operations*
*hello@wellspringgrants.com | wellspringgrants.com*
*Last updated: April 16, 2026*
