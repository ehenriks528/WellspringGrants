# Wellspring Grants — Project Context

## What This Is
An AI-powered grant writing web app for small nonprofits. Clients submit 
an intake form, Claude API generates a complete grant application, 
the owner does a 20-min QA pass and delivers within 48 hours.

## Business Rules (Never Violate These)
- Every build decision must prioritize simplicity over cleverness
- Each feature must be testable in isolation before moving forward
- No step proceeds until the previous step is verified working
- Always explain what you built and why before moving to the next step

## Tech Stack
Node.js + Express, vanilla HTML/CSS, Claude API (claude-sonnet-4-20250514),
Railway for hosting, Stripe for payments, Google Drive for delivery

## Build Order (Do Not Skip Steps)
1. Intake form (frontend)
2. Form submission handler (backend)
3. Claude API prompt builder + generation
4. Admin review dashboard
5. Client confirmation email
6. Stripe payment integration
7. Hosting + domain connection

## Pressure Testing Rule
Before recommending any step, confirm:
- Is this the simplest possible solution?
- Is there a more reliable alternative?
- What breaks if this fails?
