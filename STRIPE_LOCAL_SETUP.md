# Stripe CLI — Local Webhook Testing

The Wellspring Grants app uses a Stripe webhook at `/webhook` to trigger grant
generation after payment. In production, Stripe calls this endpoint directly on
Railway. Locally, you need the Stripe CLI to forward those events to your
laptop.

---

## One-time setup

### 1. Install the Stripe CLI

On Mac with Homebrew:

```
brew install stripe/stripe-cli/stripe
```

Without Homebrew — download the binary directly from:
https://github.com/stripe/stripe-cli/releases/latest

Verify it installed:

```
stripe --version
```

---

### 2. Log in to your Stripe account

```
stripe login
```

This opens a browser window. Click **Allow access**. You only need to do this
once per machine.

---

## Every time you start local development

### 3. Start the webhook listener

Open a **second terminal tab** (keep your server running in the first tab) and
run:

```
stripe listen --forward-to localhost:3000/webhook
```

You will see output like this:

```
> Ready! You are using Stripe API Version [2024-xx-xx]. Your webhook signing
  secret is whsec_abc123xyz...  (^C to quit)
```

**Copy the `whsec_...` value.** Open your `.env.local` file and paste it as
the value for `STRIPE_WEBHOOK_SECRET`:

```
STRIPE_WEBHOOK_SECRET=whsec_abc123xyz...
```

**Important:** This value changes every time you restart `stripe listen`.
Update `.env.local` and restart `npm run dev` whenever it changes.

---

## Starting everything together

You need three things running at the same time. Use three terminal tabs:

| Tab | Command | What it does |
|-----|---------|--------------|
| 1 | `npm run dev:watch` | Runs the server, restarts on file changes |
| 2 | `stripe listen --forward-to localhost:3000/webhook` | Forwards Stripe events to local server |
| 3 | (your editor or spare tab) | |

---

## Testing a payment end-to-end

### Option A — Use Stripe test mode in the browser

1. Make sure `STRIPE_SECRET_KEY` in `.env.local` starts with `sk_test_`
2. Submit the intake form at http://localhost:3000/apply
3. On the Stripe checkout page, use test card number `4242 4242 4242 4242`
   with any future expiry date and any 3-digit CVC
4. After payment, watch both the server tab and the stripe listen tab for
   confirmation that the webhook fired

### Option B — Trigger a test event directly (no browser required)

In a third terminal:

```
stripe trigger checkout.session.completed
```

This fires a synthetic `checkout.session.completed` event to your local
`/webhook` endpoint. The submission ID in the synthetic event's metadata will
not match a real record in your database, so the webhook will log
`"Webhook: submission not found"` — that is expected. This command is useful
for confirming that your webhook endpoint is reachable and that signature
verification is passing.

---

## Troubleshooting

**"Webhook Error: No signatures found matching the expected signature"**
Your `STRIPE_WEBHOOK_SECRET` in `.env.local` is out of date. Copy the current
`whsec_...` value from the `stripe listen` terminal output and update
`.env.local`, then restart `npm run dev`.

**"stripe: command not found"**
Stripe CLI is not installed or not on your PATH. Re-run the install step above.

**Webhook fires but grant never generates**
Check the server tab for error output. Common causes: `ANTHROPIC_API_KEY` not
set in `.env.local`, or the submission ID in the test event doesn't match any
database record (expected for `stripe trigger`).
