# Coarse source attribution

## Problem and behavior

A visitor could arrive with a recognized campaign label, navigate to a resource,
and lose the label before submitting the fit form. The helper now carries only
approved coarse source/campaign values on existing clean same-origin public links.
For example, `/?utm_source=approved_outreach&utm_campaign=first_customer` → a
resource → `/fit` saves `email/first_customer` on the submitted inquiry. An
unlabeled inquiry saves `unattributed`; absence does not establish direct traffic.

## Policy and boundaries

The browser and server share `public/source-attribution.js`:

| Incoming source | Saved source |
| --- | --- |
| email, outreach, approved_outreach | email |
| search, google, bing, organic | search |
| referral, partner | referral |
| missing, unknown, personal or ambiguous repeated sources | unattributed |

Only `first_customer` and `resources` are retained as optional campaigns. Unknown
campaigns are dropped. No prospect names, personal IDs, arbitrary campaign text,
full landing queries or referring URLs are read or saved as source labels. A
label is client-supplied and unverified, including labels named search/organic.
It cannot establish a verified organic visit or attribution causality.

The helper uses no cookie, localStorage, sessionStorage, persistent visitor ID or
third-party analytics. Coarse labels appear in the browser URL/history. Only the
existing inquiry source field persists a normalized label when the user actually
submits. No schema or dependency change is required; no historic rows are rewritten.

Do Not Track (`1` or legacy `yes`) and Global Privacy Control suppress attribution
and optional browser events. Measurement fails closed if the shared helper fails
to load, and rechecks the preference before each event. The fit endpoint forces
unattributed on DNT/Sec-GPC requests; the optional event endpoint acknowledges but
does not save those requests. The functional inquiry and its existing signed
30-day inquiry-to-checkout cookie remain available for the requested service.

Fit and measurement requests use `referrerPolicy: origin`, retaining the Origin
needed by the existing same-origin guard while omitting page paths/queries from
the Referer header. See the [Fetch Origin algorithm](https://fetch.spec.whatwg.org/#append-a-request-origin-header).
No change to the origin guard, purchase claim checks, pricing or business terms.

## Intentional limits

- Only recognized URL labels are carried. This does not infer search engines from
  referrers, remember first touch across sessions, or recover earlier unattributed
  inquiries. Untagged visits remain unattributed.
- Only clean existing public-page links are decorated. Query-bearing functional
  links, private routes, assets, downloads, external links and hash-only anchors
  remain unchanged. Legacy redirects can discard inbound labels.
- An existing query on a public link is left intact, even if that ends attribution.
  Public canonical URLs and sitemap stay clean and unchanged.
- Event counts still cover all channels and can include QA, bots and repeat loads;
  they are not unique visitors or organic sessions. No source is added to events.
- Paid conversion linkage continues through the existing signed inquiry cookie
  and acquisition event relation. A label does not make an unpaid lead a customer.

## Validation and release

Provider-free local tests cover landing → resource → fit, direct/missing source,
privacy preferences, arbitrary source rejection, private/functional links, dynamic
links, real inquiry persistence, and the existing inquiry → checkout → purchase
relation with synthetic payment objects. No Stripe request or real charge is made.
A loopback browser fixture confirmed the real form accepted the same-origin POST,
saved `email/first_customer`, and sent only the origin in its referrer header.
The fixture used an in-memory database and a no-op acknowledger: no email.

Ship the privacy notice, helper, script references, client and server changes
together only after explicit release approval. Review the draft PR and exact-head
CI first. No production migration is needed. Roll back by reverting this change as
a unit; existing inquiries and payment relationships require no deletion/reset.
