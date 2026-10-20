# First-customer operations

Owner confirmed on October 20, 2026: review upper capacity is approximately ten
applications per two-business-day delivery period. This is a private planning
limit, not a claim of guaranteed throughput. Existing $450 pricing, revision,
refund and business-clock policies are unchanged. No new promotion is created.

## Durable acceptance and work

An additive fulfillment_jobs table stores generation, confirmation and owner
notification work. A verified payment updates the order, records revenue and
inserts all three jobs in one transaction. Any failure rolls back all three
operations so Stripe can retry. Comps reserve a valid promo use, check a
normalized email across all codes, mark the order and insert jobs together.

The worker uses short PostgreSQL row locks with SKIP LOCKED, two-minute leases,
20-second heartbeats and ownership tokens. Result writes verify the current
token in a transaction; an expired worker cannot overwrite a newer result.
A result saved before interruption is reused rather than regenerated. Jobs
retry at most three times with backoff, then remain visible for owner review.
The writer's prompt, nineteen rules, score rubric and revision loop are intact.

External generation is at-least-once: an interruption after provider completion
but before saving can require another provider call. It cannot be made exactly
once by a database token. The worker disables the SDK's hidden extra retries
and bounds job attempts. Do not use real generation as a synthetic launch test.
No existing customer rows are automatically backfilled or regenerated.

Order emails have stable provider idempotency keys per order and email type.
Automatic receipt/owner-notification retries stop after 23 hours because the
provider's deduplication window is 24 hours. An older uncertain delivery needs
receipt investigation, not a blind send. Manual final delivery remains behind
the existing ready-draft/quality/client-input/human-review controls.

## Owner controls

/admin/fulfillment shows accepted orders awaiting delivery, the private review
upper limit, job states, attempt counts and estimated writing due times. Failed
jobs have an authenticated, same-origin retry action. Retrying generation can
incur normal provider usage; first check the saved draft and error context.
The report is not an automatic ten-order sales quota or a unique-customer count.
Pause orders with PAID_ORDERS_ENABLED=false if current deadlines exceed capacity.

Shutdown stops new work and allows a short drain. Unfinished leased jobs remain
in the database and become available after their lease expires. Database and
process downtime still affect delivery; inspect overdue work after an outage.

## Tests and release

The suite exercises transaction rollback, concurrent promo claims, duplicate
payments, expired/stale workers, saved-result recovery, bounded retries,
authentication, request origins and order-email idempotency. CI runs the new
transaction tests on a real isolated PostgreSQL service; local runs can use
PGlite or TEST_DATABASE_URL with a disposable namespaced test schema. Tests
never send email or call writing/payment providers. Test schemas are removed
after each run. Never point a fixture loader at production's public schema.

The existing migration creates the queue before startup. No customer table is
dropped and no production fixture seed is run. Keep paid orders paused until
live payment mode, endpoint signing, sender verification and receipt tests pass.
Do not backfill historic generating rows without reviewing their payment and
existing output; the new worker deliberately does not assume their state.

References: PostgreSQL locking documentation:
https://www.postgresql.org/docs/current/sql-select.html
Resend idempotency documentation:
https://resend.com/docs/dashboard/emails/idempotency-keys
