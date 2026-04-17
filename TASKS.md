
# Wellspring Grants — Task List
*Last updated: April 16, 2026*
*Format: [ ] Not Started | [~] In Progress | [x] Complete*

---

## 🔴 CRITICAL — Complete Before First Real Client

- [x] 1. Migrate submissions to Railway Postgres persistent 
         storage so data survives redeployments.
         Also resolves file write race condition (NEW-B).
         Complete: Railway Postgres live, db/queries.js,
         db/migrate.js, db/seed.js all built and deployed.

- [x] 2. seed.js script with 3 fixture submissions 
         including Bright Futures test data — one command 
         reloads all test data after any deploy reset.
         Complete: db/seed.js built and working.

- [x] 3. Local development environment with .env.local 
         and localhost:3000 support.
         Complete: .env.local configured, local dev working.

- [x] 4. Stripe CLI for local webhook testing.
         Complete: stripe listen --forward-to localhost:3000/webhook
         tested and confirmed working locally.

- [x] 5. FREE FIRST GRANT — CLIENT ACQUISITION FLOW
         Complete: FIRSTGRANT promo code live in database
         (max_uses=50, 12-month expiry). Promo field on 
         apply.html with blur validation. /validate-promo 
         endpoint. /checkout promo fork: bypasses Stripe,
         marks is_comp=true, fires generation directly.
         Per-email limit: repeat emails silently redirected 
         to Stripe (no user-facing error).

- [x] 6. WEBSITE — REMOVE "WRITTEN BY AI" PROMINENCE
         Complete: All AI language removed from index.html
         hero, features, and above-fold copy. FAQ updated
         with disclosure + two new items (delivery speed,
         AI detection). Month 4 pricing note removed.
         Zero AI instances above FAQ section.

- [ ] 7. WEBSITE — COMPARISON TABLE RESEARCH
         Research and document in RESEARCH.md before 
         building any table:
         a) Upwork/Fiverr grant writer rates — avg per 
            application + avg turnaround time
         b) Full-time nonprofit grant writer salary — 
            annual cost + cost per grant at typical volume
         c) DIY cost — ED hourly rate × avg hours to 
            write a grant (time cost, not cash)
         d) Wellspring Grants — $450, 48hr turnaround,
            quality score guarantee, checklist included
         Flag any data point without a verifiable source.
         Do NOT build the table until RESEARCH.md complete.

- [ ] 8. WEBSITE — BUILD COMPARISON TABLE
         BLOCKED — do not start until Task 7 complete.
         Columns: DIY | Freelance | Full-Time Hire | 
                  Wellspring Grants
         Rows: Cost per grant | Turnaround time | 
               Quality consistency | Checklist included | 
               Revision included | Turnaround guarantee
         - Wellspring column highlighted (dark green)
         - Mobile responsive
         - No fabricated numbers — all from RESEARCH.md
         - Footnotes citing sources for all figures

- [x] NEW-A. FIX: Stripe webhook endpoint
         Complete: /webhook route live with signature 
         verification. STRIPE_WEBHOOK_SECRET set in Railway.
         Production endpoint registered in Stripe Dashboard 
         for wellspringgrants.com/webhook.
         checkout.session.completed tested end-to-end.

- [x] NEW-B. FIX: File write race condition
         Resolved by Task 1 (Postgres migration complete).
         submissions.json is now read-only backup — all
         reads and writes go through db/queries.js.

- [ ] NEW-C. FIX: Footer ID retrieval bug
         createDoc.js — fRes.data.replies[0].createFooter
         .headerId is always undefined. The Google Docs API
         returns footerId not headerId for createFooter 
         responses. Fallback works but the dead code path
         is misleading.
         Fix: remove the .headerId reference entirely, use 
         only the defaultFooterId refetch path.

- [ ] NEW-D. CLEANUP: Dev artifacts + CLAUDE.md model name
         - Delete test-output.txt and test-prompt.js from root
         - Add both to .gitignore
         - Update CLAUDE.md model name reference if outdated
         - Move any credentials JSON to /credentials dir
           and confirm .gitignore covers it

---

## 🟡 IMPORTANT — Complete Within 30 Days

- [x] 9.  Submission status field and lifecycle tracking.
          Complete: status column in Postgres.
          Lifecycle: pending_payment → paid → generating →
          qa_complete → delivered → failed.
          Admin dashboard shows color-coded status badges.

- [ ] 10. Add try/catch + admin email alert on all 
          Claude API failures — no silent failures.

- [x] 11. Automated client confirmation email on payment.
          Complete: sendConfirmationEmail() in sendEmail.js,
          fires on webhook checkout.session.completed.

- [ ] 12. Log funder guidelines fetch status per 
          submission; flag failures visibly in admin 
          dashboard and Review Notes — never silent.

- [x] 13. Intake form — 4 missing required fields.
          Complete: EIN, Authorized Signer Name + Title,
          Organization Phone + Full Mailing Address,
          Annual Budget validation prompt all added.

- [x] 14. Grant output — split into two documents.
          Complete: Clean grant body → Google Doc.
          QA Report → admin dashboard only.
          Zero internal flags in client-facing doc.

- [x] 15. Google Docs API integration.
          Complete: OAuth set up, Drive + Docs API live.
          Docs created in client subfolder in Wellspring Drive.
          Shared with client email. Doc URL in admin + email.

- [x] 16. Google Doc formatting standards.
          Complete: Georgia body, Arial headings, cover page
          metadata, budget table with green header + 
          alternating rows + totals row, header/footer.

- [x] 17. Master Grant Prompt — Rules 16, 17, 18.
          Complete: EIN Lock, Authorized Signer Block,
          Opening Story Uniqueness Test all in prompt.

---

## 🟢 PLANNED — Complete Within 90 Days

- [x] 18. Admin dashboard.
          Complete: 2-panel layout (submission list + detail).
          Color-coded QA scores, status badges, collapsible
          detail. HTTP Basic Auth on all /admin routes.
          Google Doc creation button. Approve & Mark 
          Delivered button. Delivery email on approval.

- [x] 19. Automated client delivery.
          Complete: POST /admin/submission/:id/mark-delivered
          sends delivery email via sendDeliveryEmail(),
          updates status to delivered, returns JSON.
          Admin button disables on success, shows timestamp.
          Email: personalized, doc link, 3 next steps,
          "Before You Submit" checklist.

- [ ] 20. Revision request flow:
          - Revision intake form (section + requested change)
          - Revision prompt template in grant engine
          - One revision per grant included in pricing
          - Track revision status in submission record

- [ ] 21. Retainer client management:
          - Client record: name, org, retainer status, 
            upcoming grant deadlines
          - Google Sheet acceptable at this stage
          - Admin dashboard view as later improvement

- [x] 22. Grant Quality Scoring Engine.
          Complete: 6-dimension weighted rubric (1-10 each),
          self-improvement loop (rewrite until 8.6+),
          max 3 revision cycles, CLIENT INPUT REQUIRED 
          report if below threshold after 3 cycles.

- [x] 23. Insufficient context protocol.
          Complete: Web knowledge fallback, 🌐 WEB-SOURCED 
          flags, absolute ban on invented facts, CLIENT INPUT
          REQUIRED report format, draft follow-up email.

- [x] 24. End-to-end pipeline test in Stripe test mode.
          Complete: Full flow tested — form → Stripe payment
          → webhook → generation (9.0/10) → QA report → 
          Google Doc creation → Approve & Mark Delivered →
          delivery email received by client. All stages 
          confirmed working in production.

---

## ⚠️ PENDING VERIFICATION

- [~] Google Doc subheading asterisks
      Issue: Project Description subsection labels (e.g., 
      *Component 1: Certified Reading Tutors*) were 
      rendering with literal asterisks in the Google Doc.
      Fix deployed (commit 7f4e48c): stripInlineMarkdown()
      now handles single *italic* markers in body text.
      subHeading stripping already handles ### headers.
      STATUS: Fix deployed — needs one test submission to 
      confirm asterisks no longer appear in any section.
      TO DO: Submit new intake form with FIRSTGRANT, 
      generate grant, create doc, verify subheadings clean.

---

## 📋 REFERENCE — Automation Gap Status

| Stage                     | Status          | Notes                        |
|---------------------------|-----------------|------------------------------|
| Intake form submission    | ✅ Complete      | All fields including EIN     |
| Payment collection        | ✅ Complete      | Stripe Checkout + webhook    |
| Grant generation          | ✅ Complete      | 18 rules, 8.6 threshold      |
| QA engine                 | ✅ Complete      | 6-dimension scoring          |
| Document separation       | ✅ Complete      | Grant body vs QA report      |
| Google Docs export        | ✅ Complete      | Formatting pipeline live     |
| Admin review dashboard    | ✅ Complete      | 2-panel, auth, status mgmt   |
| Automated delivery email  | ✅ Complete      | Fires on admin approval      |
| Promo code system         | ✅ Complete      | FIRSTGRANT, per-email limit  |
| Cold email outreach       | ⏸️ Not started  | See checklist in CLAUDE.md   |
| Revision request flow     | ❌ Not built     | Task 20                      |
| Retainer management       | ❌ Not built     | Task 21                      |

**Current automation level: ~95% of core pipeline**

---

*Wellspring Grants — Internal Operations*
*hello@wellspringgrants.com*
