# Public acquisition site and intake

## Public pages

The marketing source is in marketing/pages.js, faq.js, sample.js and privacy.js.
Run npm run build:marketing to generate the HTML and route manifest. The server
serves clean canonical routes, redirects generated .html alternatives, and exposes
robots.txt and sitemap.xml. Production canonical origin is wellspringgrants.com.

The fifteen public routes include the homepage, service and pricing information,
process, About, Contact, FAQ, privacy, service terms, quality/AI explanation, an
annotated fictional sample, a resource hub and three practical guides. The sample
download is plain text. No client testimonials, grants directory or award-rate
claims are generated.

The new interface uses system fonts, vanilla browser code and the existing logo.
There are no new production dependencies, external fonts, advertising pixels,
newsletter enrollments or automatic outbound sends.

## Shared offer and business clock

marketing/service.js records the $450 USD offer and service policies. The included
revision round is available within 14 days of delivery; additional rounds are $50,
arranged separately by support. Orders cannot be canceled/refunded after payment.
No automatic $50 revision-charge mechanism is introduced.

public/business-clock.js is shared by server deadline validation, the intake
estimate and confirmation email. Delivery takes two Monday–Friday calendar days
after payment and complete intake. The intake-start window is 09:00–17:00
America/New_York. Outside that window, the start is 09:00 the next business day.
A Friday-evening request starts Monday at 09:00 and is due Wednesday at 09:00.
Weekends are excluded; no additional public-holiday calendar is assumed.

The engine's writing rules, scoring weights and revision loop remain intact.
Only the customer-facing clarification email timing text changes in the prompt.

## Intake and optional draft storage

The form progressively enhances into four steps. A plain HTML form fallback
remains available. Address fields derive the legacy location value; exact funder
cutoff and budget-period context are appended to the existing requirements field.
The enhanced checkout receives a JSON destination or a recoverable error rather
than navigating away and losing answers.

Draft storage is optional. Save explicitly stores allowlisted string fields,
encrypted with AES-256-GCM using a purpose-derived key from ADMIN_PASSWORD.
A random 256-bit bearer is stored only in an HttpOnly, SameSite=Strict cookie,
Secure for HTTPS, scoped to the draft API. The database stores only its SHA-256
hash. Seven-day expiry is fixed from creation, not extended on edits. Cleanup
runs at startup and every six hours. Changing ADMIN_PASSWORD invalidates older
encrypted drafts. Do not run production with a weak or shared default password.

Drafts exclude promo codes and purchase acknowledgment. Delete removes only the
current browser-authorized draft. No answers or resume tokens are persisted in
browser storage or inserted into URLs.

## Additive database changes

The npm start lifecycle runs npm run migrate and builds marketing pages before starting the server. A migration failure prevents the new process from starting. You can also run npm run migrate separately in the target environment before exposing the updated app.
In addition to the earlier acquisition tables, the migration creates intake_drafts,
organic_funnel_events and purchase_scope_acknowledgments. No existing table or
customer record is dropped. The standard migration retains its preexisting schema
and promo initialization behavior; it is not a production test/fixture seed.

Do not run npm run seed:prod as part of this release.

## Measurement

/admin/funnel and /admin/api/funnel inherit the existing admin authentication.
The report aggregates public-page and step activity plus the earlier verified
payment-event ledger. Browser events are allowlisted, contain no free text or
contact records, and use a new random event ID per event rather than a persistent
visitor identifier. DNT=1 skips optional browser event recording.

Counts are not unique-visitor or cohort conversion rates. The report labels this
limitation. Live receipts exclude tests/comps; Stripe remains the source for
refunds, fees and disputes. /apply, /fit, checkout-related pages, API responses
and admin routes are excluded from indexing. Private records still require real
authorization; noindex is not an access control.

## Validation and rollout

npm test exercises isolated database/API behavior, deadline/timezone conversion,
actual checkout-handler logic with a mocked payment provider, metadata/routes,
sample response limits, draft isolation/expiry and payment deduplication.

node test/preview.js runs a loopback-only in-memory preview on port 4318.
It has no payment, email or generation connections. Its admin authentication is
deliberately omitted for local review; it must never be deployed.

Before release, verify target configuration and migration, current Stripe
test-mode checkout/webhook behavior, sender and document-delivery configuration,
and the site's public smoke checks. A successful test run does not establish
real inbox delivery, provider credentials, indexing or field performance.

Retain the prior app revision for rollback; keep additive tables and records.
Do not drop tables as a rollback. Follow the owner's actual deployment
authorization. Existing generation is still an in-process job and promo
redemption is not atomic; these preexisting limits need separate durable-job
and concurrency work before substantial scale.
