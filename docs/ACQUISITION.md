# Grant-fit inquiry and review queue

Adds `/fit` for presale inquiries and `/admin/leads` for authenticated lead review, follow-up tracking and exact-draft outreach approval. Approval records a decision; it never sends outbound email. Opt-outs suppress future approvals. Inquiry acknowledgments use the existing Resend sender and persisted, bounded retry state.

## Configuration and migration

Preserve existing application environment variables. `APP_URL` must be the canonical site origin. `ADMIN_PASSWORD` must have at least 12 characters. `OUTREACH_POSTAL_ADDRESS` is optional; without it outreach cannot be approved. Set it only to a verified business mailing address.

Run `npm run migrate` in the intended environment before deploying the webhook update. The added tables are idempotent and additive. Take a database backup before production maintenance. Do not seed test fixtures into production.

## Measurement

Only a verified, paid USD $450 Stripe Checkout session can produce a purchase event. The signed webhook claims the pending submission and inserts the conversion in one database transaction. Duplicate deliveries cannot count twice. Legacy sessions without saved session IDs require an intake-email match. Gross live receipts are shown separately from test payments and comps; use Stripe for refunds, disputes, fees and accounting. Inquiry attribution uses a signed first-party cookie and explicit source label; it is limited to the same browser.

## Test and review

`npm ci` then `npm test` runs isolated PostgreSQL/API tests with synthetic payment sessions and mocked email acceptance. No card is charged or message sent. `node test/preview.js` starts an isolated loopback preview at `http://127.0.0.1:4317/fit`, with an in-memory database and no email/payment connections. The preview deliberately omits admin authentication and must never be deployed or exposed publicly.

Before production rollout, separately verify real Stripe test-mode webhook signatures and checkout, sender domain authentication and inbox receipt/reply, Google document sharing/export, complete paid intake and human delivery, database persistence, and proxy configuration. New direct document sharing happens only on delivery approval. Review any remaining dependency advisories before release.

## Limits

The existing grant generation job is still in-process and can be stranded by a restart after payment claim. Existing payment confirmation/admin notifications do not have the new inquiry outbox. Existing promo usage validation/redemption is not atomic. Monitor these paths at low-volume launch and add durable recovery before scaling. Request rate limits are process-local for a single reverse-proxied replica; shared limits are needed when scaling.

Drafts are immutable. Create a fresh draft to change its text/evidence. Approvals use the current shared admin identity, not individual staff attribution. Eligibility evidence and public contact sources require human verification; saving a record cannot establish final eligibility or willingness to pay. No contact enrichment, bulk sending, automatic follow-up, ad pixels, or recurring prospect monitor is included.

Rollback the app revision if necessary; retain the additive tables and data. Do not drop tables as a rollback procedure. Changes to production deployment and payment behavior require owner review and approval.
