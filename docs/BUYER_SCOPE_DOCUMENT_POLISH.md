# Buyer scope, structured data and document-header polish

This bounded change improves existing pages and document layout. It adds no
indexed URL, dependency, database migration, payment behavior or provider call.

## Existing service page

The nonprofit grant-writing page now distinguishes a selected application from
funder research, existing-draft/letter-of-inquiry work and ongoing management.
It explains what to provide for a fit review, links to the existing preparation,
price, sample and technology pages, and clarifies that the extra-revision fee
is not a stand-alone editing quote. The fixed offer and policies are unchanged.

Pricing and service pages identify the same Service and Offer in JSON-LD, using
the shared price/currency configuration and the existing Organization identity.
There are no invented ratings, availability, award outcomes or geographic
coverage claims. This markup describes the visible offer; it does not promise
a Google rich result or ranking improvement.

Resource breadcrumbs now link Home → Resources → current article, and their
BreadcrumbList reflects that same hierarchy. Other pages keep the actual
Home → current page path; no nonexistent services hub is added.

## Document header

The old header placed organization, funder and a confidentiality notice in one
tab-separated paragraph. Word could concatenate the text when the names filled
the available width. Identifiers now occupy one compact paragraph, followed by
a separate notice paragraph. Both receive the same font styling; the lower
border and spacing belong to the final paragraph.

Header identifiers collapse whitespace and shorten at 24 grapheme clusters with
an ellipsis. This avoids splitting accented letters or multi-code-point emoji.
Full organization/funder names remain on the cover page. Footer text and styling,
body formatting and the writing engine are unchanged. Existing documents are
not rewritten; the layout applies when a document is next created.

## Validation and limits

Provider-free unit tests exercise the actual header/footer request builder
through a mock Docs client, including long/Unicode names, separate paragraphs,
style ranges and footer preservation. Metadata tests check offer consistency,
absence of invented availability/ratings and resource hierarchy. The full local
suite passes 43 tests. Browser review covers desktop and 390-pixel mobile page
layout, with no horizontal page overflow, plus navigation to the resource hub.

No additional live Google document/export or email test was run. The local
request tests are not a claim of a newly verified cloud-rendered Word export.
A future authorized document creation should receive normal visual review.
Indexing and search performance require Search Console/traffic evidence and are
not established by canonical/schema tests alone.

## Review and rollback

Keep the PR in draft until reviewed. Do not combine deployment with payment
activation or credential changes. This change has no migration to roll back.
If a later release needs reversal, revert these commits normally and rebuild
marketing pages; do not rewrite shared history or modify customer documents.
The marketing and document changes are separate commits so either can be
reverted independently.

References:
- https://schema.org/Service
- https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request
