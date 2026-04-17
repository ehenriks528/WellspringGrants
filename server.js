require('dotenv').config();

const express    = require('express');
const path       = require('path');
const basicAuth  = require('express-basic-auth');
const Stripe     = require('stripe');
const { generateGrant }       = require('./generateGrant');
const { sendConfirmationEmail, sendDeliveryEmail } = require('./sendEmail');
const { createGrantDoc, exportDocAsDocx } = require('./createDoc');
const {
  pool,
  createSubmission,
  getSubmission,
  updateSubmission,
  getAllSubmissions,
  validatePromoCode,
  redeemPromoCode,
} = require('./db');

const app    = express();
const PORT   = process.env.PORT || 3000;
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ─── Webhook route ────────────────────────────────────────────────────────────
// MUST be registered before express.json() / express.urlencoded() so that
// stripe.webhooks.constructEvent() receives the raw request body.

app.post('/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature failed:', err.message);
      return res.status(400).send('Webhook Error: ' + err.message);
    }

    if (event.type === 'checkout.session.completed') {
      const session      = event.data.object;
      const submissionId = session.metadata?.submissionId;

      if (!submissionId) {
        console.error('Webhook: no submissionId in metadata');
        return res.json({ received: true });
      }

      const submission = await getSubmission(submissionId);

      if (!submission) {
        console.error('Webhook: submission not found:', submissionId);
        return res.json({ received: true });
      }

      // Idempotency guard — only process once
      if (submission.status !== 'pending_payment') {
        console.log('Webhook: already processed:', submissionId);
        return res.json({ received: true });
      }

      await updateSubmission(submissionId, {
        status:           'generating',
        stripe_session_id: session.id,
        paid_at:          new Date().toISOString(),
      });

      // Fire generation and email — non-blocking
      generateGrant(submissionId).catch(err => {
        console.error('Generation failed:', submissionId, err.message);
      });

      sendConfirmationEmail(submission).catch(err => {
        console.error('Confirmation email failed:', submissionId, err.message);
      });

      console.log('Webhook: generation triggered for', submissionId);
    }

    res.json({ received: true });
  }
);

// ─── Body parsers (after webhook route) ──────────────────────────────────────

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

// ─── Admin auth ───────────────────────────────────────────────────────────────

app.use('/admin', basicAuth({
  users: { admin: process.env.ADMIN_PASSWORD },
  challenge: true,
  realm: 'Wellspring Grants Admin',
}));

// ─── Helper functions ─────────────────────────────────────────────────────────

function statusBadge(status) {
  const styles = {
    pending_payment:   'background:#e2e3e5;color:#41464b;',
    generating:        'background:#fff3cd;color:#856404;',
    draft_ready:       'background:#d1e7dd;color:#0a3622;',
    input_required:    'background:#ffe5d0;color:#7d2c00;',
    generation_failed: 'background:#f8d7da;color:#842029;',
    delivered:         'background:#cfe2ff;color:#084298;',
  };
  const labels = {
    pending_payment:   'Awaiting Payment',
    generating:        'Generating...',
    draft_ready:       'Draft Ready',
    input_required:    'Client Input Required',
    generation_failed: 'Generation Failed',
    delivered:         'Delivered',
  };
  const style = styles[status] || 'background:#e2e3e5;color:#41464b;';
  const label = labels[status] || status;
  return `<span style="padding:3px 10px;border-radius:12px;font-size:12px;font-weight:bold;${style}">${label}</span>`;
}

function trimBody(body) {
  const cleaned = {};
  for (const [key, value] of Object.entries(body)) {
    cleaned[key] = typeof value === 'string' ? value.trim() : value;
  }
  return cleaned;
}

// ─── Public routes ────────────────────────────────────────────────────────────

app.get('/apply', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'apply.html'));
});

// Validate a promo code without redeeming it — called by the intake form on blur.
// Never reveals why a code is invalid beyond the generic message.
app.get('/validate-promo', async (req, res) => {
  const code  = (req.query.code  || '').trim().toUpperCase();
  const email = (req.query.email || '').trim().toLowerCase();

  if (!code) {
    return res.json({ valid: false, message: 'Invalid or expired code' });
  }

  const record = await validatePromoCode(code);

  if (record) {
    // If an email was provided, check whether it has already used a promo code
    if (email) {
      const priorUse = await pool.query(
        'SELECT COUNT(*) FROM submissions WHERE contact_email = $1 AND promo_code_used IS NOT NULL',
        [email]
      );
      if (parseInt(priorUse.rows[0].count, 10) > 0) {
        return res.json({ valid: false, already_used: true });
      }
    }
    return res.json({ valid: true });
  }

  res.json({ valid: false });
});

// Receive form, save as pending_payment, then fork:
//   — valid promo code → bypass Stripe, fire generation immediately
//   — no code / invalid code → redirect to Stripe Checkout as normal
app.post('/checkout', async (req, res) => {
  const id      = String(Date.now());
  const rawBody = trimBody(req.body);

  // Extract promo code before building the submission record.
  // promo_code and promo_valid are form-only fields — neither is a DB column.
  const promoCode = rawBody.promo_code ? rawBody.promo_code.toUpperCase() : null;
  delete rawBody.promo_code;
  delete rawBody.promo_valid;

  const submission = {
    id,
    submitted_at: new Date().toISOString(),
    status: 'pending_payment',
    ...rawBody,
  };

  console.log('\n--- New Submission (awaiting payment) ---');
  console.log('From:', submission.contact_name, '<' + submission.contact_email + '>');
  console.log('Org:', submission.org_name);
  console.log('Funder:', submission.funder_name);
  if (promoCode) console.log('Promo code submitted:', promoCode);
  console.log('-----------------------------------------\n');

  try {
    await createSubmission(submission);
  } catch (err) {
    console.error('Failed to save submission:', err.message);
    return res.status(500).send('Submission could not be saved. Please try again or contact hello@wellspringgrants.com.');
  }

  // ── Promo code path ────────────────────────────────────────────────────────
  // Validate independently of anything the frontend sent — the backend is
  // the only authority on whether a code is valid.
  if (promoCode) {
    const promoRecord = await validatePromoCode(promoCode);

    if (promoRecord) {
      // One promo use per email address — check if this email has already used any promo code
      const priorUse = await pool.query(
        'SELECT COUNT(*) FROM submissions WHERE contact_email = $1 AND promo_code_used IS NOT NULL',
        [submission.contact_email]
      );
      const alreadyUsed = parseInt(priorUse.rows[0].count, 10) > 0;

      if (alreadyUsed) {
        // Silently fall through to Stripe — no error shown to client
        console.log(`Promo code blocked for repeat email (${submission.contact_email}), proceeding to Stripe`);
      } else {
      // Redeem the code and mark the submission as a comp
      await redeemPromoCode(promoCode);
      await updateSubmission(id, {
        status:          'generating',
        is_comp:         true,
        promo_code_used: promoCode,
        paid_at:         new Date().toISOString(),
      });

      // Fire generation and email — identical to the paid webhook path
      generateGrant(id).catch(err => {
        console.error('Generation failed (comp):', id, err.message);
      });

      sendConfirmationEmail(submission).catch(err => {
        console.error('Confirmation email failed (comp):', id, err.message);
      });

      console.log(`Comp submission processed (${promoCode}): ${id}`);
      return res.redirect('/confirmation.html');
      } // end !alreadyUsed
    }

    // Code was submitted but is invalid/expired/already used — fall through to Stripe
    console.log(`Promo code not applied (${promoCode}), proceeding to Stripe`);
  }

  // ── Stripe path (no code, or invalid code) ─────────────────────────────────
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Grant Application — Single',
            description: `${submission.org_name} · ${submission.funder_name}`,
          },
          unit_amount: 45000, // $450.00 in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: submission.contact_email,
      metadata: { submissionId: id },
      success_url: `${process.env.APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.APP_URL}/payment-cancelled`,
    });

    res.redirect(303, session.url);
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).send('Payment setup failed. Please try again or contact hello@wellspringgrants.com.');
  }
});

// Stripe redirects here after successful payment.
// Grant generation is now triggered exclusively by the /webhook route.
// This route only confirms the session and redirects — it must NOT fire generateGrant().
app.get('/payment-success', async (req, res) => {
  const { session_id } = req.query;

  if (!session_id) {
    return res.redirect('/');
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') {
      return res.redirect('/payment-cancelled');
    }
  } catch (err) {
    console.error('Payment verification error:', err.message);
  }

  res.redirect('/confirmation.html');
});

app.get('/payment-cancelled', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment-cancelled.html'));
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

app.get('/admin', async (req, res) => {
  const submissions = await getAllSubmissions(); // already newest-first from DB

  const rows = submissions.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:#888;">No submissions yet.</td></tr>`
    : submissions.map(s => {
        const scoreColor = s.quality_score == null ? '#aaa' : s.quality_score >= 8.6 ? '#0a3622' : '#7d2c00';
        const scoreLabel = s.quality_score != null ? `${s.quality_score.toFixed(1)}/10` : '—';
        return `
        <tr>
          <td style="padding:14px 16px;">
            <strong>${s.org_name || '—'}</strong><br>
            <span style="font-size:13px;color:#666;">${s.contact_email || ''}</span>
          </td>
          <td style="padding:14px 16px;">${s.funder_name || '—'}</td>
          <td style="padding:14px 16px;">${s.grant_deadline || '—'}</td>
          <td style="padding:14px 16px;">$${Number(s.amount_requested || 0).toLocaleString()}</td>
          <td style="padding:14px 16px;font-weight:bold;color:${scoreColor};">${scoreLabel}</td>
          <td style="padding:14px 16px;">
            ${statusBadge(s.status)}${s.is_comp ? ' <span style="background:#d1e7dd;color:#0a3622;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:bold;letter-spacing:0.3px;margin-left:4px;">COMP</span>' : ''}
          </td>
          <td style="padding:14px 16px;">
            <a href="/admin/submission/${s.id}" style="color:#2a6049;font-weight:bold;text-decoration:none;">View →</a>
          </td>
        </tr>`;
      }).join('');

  const counts    = submissions.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});
  const compCount = submissions.filter(s => s.is_comp).length;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wellspring Grants — Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; background: #f4f1eb; color: #2c2c2c; padding: 40px 24px; }
    .header { max-width: 1000px; margin: 0 auto 32px; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 20px; font-weight: bold; color: #2a6049; }
    .subtitle { font-size: 13px; color: #888; margin-top: 2px; }
    .stats { display: flex; gap: 16px; }
    .stat { background: #fff; border-radius: 8px; padding: 14px 20px; text-align: center; min-width: 100px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    .stat-number { font-size: 24px; font-weight: bold; color: #2a6049; }
    .stat-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .card { max-width: 1000px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    thead { background: #2a6049; color: white; }
    th { padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; }
    tbody tr { border-bottom: 1px solid #f0ede6; }
    tbody tr:hover { background: #faf9f6; }
    tbody tr:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Wellspring Grants — Admin</div>
      <div class="subtitle">${submissions.length} total submission${submissions.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-number">${counts.draft_ready || 0}</div>
        <div class="stat-label">Ready to Deliver</div>
      </div>
      <div class="stat">
        <div class="stat-number">${counts.generating || 0}</div>
        <div class="stat-label">Generating</div>
      </div>
      <div class="stat" style="${(counts.input_required || 0) > 0 ? 'border:2px solid #f4a261;' : ''}">
        <div class="stat-number" style="color:${(counts.input_required || 0) > 0 ? '#7d2c00' : '#2a6049'};">${counts.input_required || 0}</div>
        <div class="stat-label">Needs Input</div>
      </div>
      <div class="stat">
        <div class="stat-number">${counts.delivered || 0}</div>
        <div class="stat-label">Delivered</div>
      </div>
      <div class="stat">
        <div class="stat-number" style="color:${compCount > 0 ? '#0a3622' : '#2a6049'};">${compCount}</div>
        <div class="stat-label">Complimentary</div>
      </div>
    </div>
  </div>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Organization</th>
          <th>Funder</th>
          <th>Deadline</th>
          <th>Amount</th>
          <th>Score</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body>
</html>`);
});

app.get('/admin/submission/:id', async (req, res) => {
  const submission = await getSubmission(req.params.id);

  if (!submission) return res.status(404).send('Submission not found.');

  // ── Left panel: client-ready grant body ────────────────────────────────────

  const scoreDisplay = submission.quality_score != null
    ? `<div style="font-size:28px;font-weight:bold;color:${submission.quality_score >= 8.6 ? '#0a3622' : '#7d2c00'};">${submission.quality_score.toFixed(1)} <span style="font-size:14px;font-weight:normal;color:#888;">/ 10</span></div>
       <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-top:2px;">Quality Score ${submission.quality_score >= 8.6 ? '✓ Passed' : '— Below threshold'}</div>`
    : '<div style="color:#aaa;font-size:13px;">Score not yet available</div>';

  const clientGrantPanel = submission.grant_body
    ? `<div id="grant-body" style="background:#fafaf8;border:1px solid #e8e4dc;border-radius:6px;padding:28px 32px;line-height:1.8;font-size:14px;max-height:700px;overflow-y:auto;"></div>
       <script>document.getElementById('grant-body').innerHTML = marked.parse(${JSON.stringify(submission.grant_body)});</script>`
    : `<div style="padding:40px;text-align:center;color:#888;background:#fafaf8;border:1px solid #e8e4dc;border-radius:6px;">
         ${submission.status === 'generating' ? 'Grant is generating — refresh in a moment.' : 'No draft available yet.'}
       </div>`;

  const createDocButton = (submission.status === 'draft_ready' || submission.status === 'input_required') && !submission.doc_url
    ? `<form method="POST" action="/admin/submission/${submission.id}/create-doc">
         <button type="submit" style="width:100%;background:#1b4332;color:white;border:none;padding:12px 20px;border-radius:5px;font-size:14px;font-family:Georgia,serif;cursor:pointer;font-weight:bold;margin-top:12px;">Create Google Doc →</button>
       </form>`
    : '';

  const docLink = submission.doc_url
    ? `<a href="${submission.doc_url}" target="_blank" style="display:block;text-align:center;background:#fff;border:2px solid #1b4332;color:#1b4332;padding:11px 18px;border-radius:5px;font-size:14px;font-family:Georgia,serif;font-weight:bold;text-decoration:none;margin-top:12px;">Open Google Doc ↗</a>`
    : '';

  const deliveredLabel = submission.delivered_at
    ? new Date(submission.delivered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const approveButton = submission.status === 'draft_ready' && submission.doc_url
    ? `<button id="deliver-btn" onclick="deliverSubmission('${submission.id}')" style="width:100%;background:#084298;color:white;border:none;padding:12px 20px;border-radius:5px;font-size:14px;font-family:Georgia,serif;cursor:pointer;font-weight:bold;margin-top:8px;">Approve &amp; Mark Delivered</button>`
    : submission.status === 'delivered'
      ? `<div style="width:100%;background:#e2e3e5;color:#41464b;border:none;padding:12px 20px;border-radius:5px;font-size:14px;font-family:Georgia,serif;font-weight:bold;margin-top:8px;text-align:center;">✓ Delivered ${deliveredLabel}</div>`
      : '';

  const inputRequiredBanner = submission.client_input_required
    ? `<div style="background:#ffe5d0;border:1px solid #f4a261;border-radius:6px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#7d2c00;">
         <strong>Client Input Required</strong> — Grant could not reach 8.6 quality score. See QA Report for the questions to send the client.
       </div>`
    : '';

  // ── Right panel: internal QA report ────────────────────────────────────────

  const qaPanel = submission.qa_report
    ? `<div id="qa-report" style="background:#fffef8;border:1px solid #e8e4dc;border-radius:6px;padding:28px 32px;line-height:1.7;font-size:13px;max-height:700px;overflow-y:auto;"></div>
       <script>document.getElementById('qa-report').innerHTML = marked.parse(${JSON.stringify(submission.qa_report)});</script>`
    : `<div style="padding:40px;text-align:center;color:#888;background:#fffef8;border:1px solid #e8e4dc;border-radius:6px;">
         No QA report available.
       </div>`;

  const generatedAt = submission.grant_generated_at
    ? `Generated ${new Date(submission.grant_generated_at).toLocaleString()}`
    : '';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${submission.org_name} — Wellspring Admin</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; background: #f4f1eb; color: #2c2c2c; padding: 32px 24px; }
    .container { max-width: 1300px; margin: 0 auto; }
    .back { color: #2a6049; text-decoration: none; font-size: 14px; display: inline-block; margin-bottom: 20px; }
    .back:hover { text-decoration: underline; }
    .top-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    h1 { font-size: 22px; color: #1a1a1a; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #666; line-height: 1.7; }
    .two-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
    @media (max-width: 900px) { .two-panel { grid-template-columns: 1fr; } }
    .panel { background: #fff; border-radius: 8px; padding: 24px 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    .panel-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #2a6049; font-weight: bold; margin-bottom: 16px; border-bottom: 1px solid #e8e4dc; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    .panel-label.qa-label { color: #7d2c00; }
    .score-box { background: #f4f1eb; border-radius: 6px; padding: 16px 20px; margin-bottom: 16px; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin-bottom: 16px; }
    .field label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #999; font-weight: bold; display: block; margin-bottom: 2px; }
    .field p { font-size: 13px; color: #2c2c2c; line-height: 1.5; }
    .field-full { grid-column: 1 / -1; }
    #grant-body h2, #qa-report h2 { font-size: 15px; color: #1b4332; margin: 20px 0 8px; border-bottom: 1px solid #e8e4dc; padding-bottom: 4px; }
    #grant-body h2:first-child, #qa-report h2:first-child { margin-top: 0; }
    #grant-body h3, #qa-report h3 { font-size: 13px; color: #2d6a4f; margin: 14px 0 6px; }
    #grant-body p, #qa-report p { margin-bottom: 10px; font-size: 13px; }
    #grant-body ul, #grant-body ol, #qa-report ul, #qa-report ol { margin: 0 0 10px 20px; }
    #grant-body li, #qa-report li { margin-bottom: 4px; font-size: 13px; }
    #grant-body strong, #qa-report strong { color: #1a1a1a; }
    #qa-report table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
    #qa-report th { background: #1b4332; color: white; padding: 6px 10px; text-align: left; }
    #qa-report td { padding: 5px 10px; border-bottom: 1px solid #e8e4dc; }
  </style>
</head>
<body>
  <div class="container">
    <a href="/admin" class="back">← Back to Dashboard</a>

    <div class="top-bar">
      <div>
        <h1>${submission.org_name}</h1>
        <div class="meta">
          ${statusBadge(submission.status)} &nbsp;
          Submitted ${new Date(submission.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          &nbsp;·&nbsp; ${submission.contact_name || ''} &lt;${submission.contact_email || ''}&gt;
          ${submission.paid_at ? `&nbsp;·&nbsp; Paid ${new Date(submission.paid_at).toLocaleDateString()}` : ''}
          ${generatedAt ? `&nbsp;·&nbsp; ${generatedAt}` : ''}
        </div>
      </div>
    </div>

    <!-- Submission Details (collapsed at top) -->
    <div style="background:#fff;border-radius:8px;padding:20px 28px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.07);">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#2a6049;font-weight:bold;margin-bottom:14px;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'grid':'none'">Submission Details ▾</div>
      <div class="details-grid">
        <div class="field"><label>Funder</label><p>${submission.funder_name || '—'}</p></div>
        <div class="field"><label>Grant Program</label><p>${submission.grant_program || '—'}</p></div>
        <div class="field"><label>Amount Requested</label><p>$${Number(submission.amount_requested || 0).toLocaleString()}</p></div>
        <div class="field"><label>Deadline</label><p>${submission.grant_deadline || '—'}</p></div>
        <div class="field"><label>EIN</label><p>${submission.ein || '—'}</p></div>
        <div class="field"><label>501(c)(3)</label><p>${submission.tax_exempt || '—'}</p></div>
        <div class="field"><label>Authorized Signer</label><p>${submission.signer_name || '—'} — ${submission.signer_title || '—'}</p></div>
        <div class="field"><label>Phone</label><p>${submission.org_phone || '—'}</p></div>
        <div class="field field-full"><label>Address</label><p>${submission.org_street || ''} ${submission.org_city || ''}, ${submission.org_state || ''} ${submission.org_zip || ''}</p></div>
        <div class="field field-full"><label>Guidelines URL</label><p><a href="${submission.guidelines_url}" target="_blank" style="color:#2a6049;">${submission.guidelines_url || '—'}</a></p></div>
        <div class="field field-full"><label>Problem Statement</label><p>${submission.problem_statement || '—'}</p></div>
        <div class="field field-full"><label>Project Description</label><p>${submission.project_description || '—'}</p></div>
        <div class="field field-full"><label>Budget Breakdown</label><p>${submission.budget_breakdown || '—'}</p></div>
        ${submission.is_comp
          ? `<div class="field field-full"><label>Billing</label><p style="color:#0a3622;font-weight:bold;">Complimentary submission (promo code: ${submission.promo_code_used || '—'})</p></div>`
          : ''}
      </div>
    </div>

    <!-- Two-panel layout -->
    <div class="two-panel">

      <!-- LEFT: Client-ready document -->
      <div class="panel">
        <div class="panel-label">
          <span>Client-Ready Document</span>
          <span style="font-weight:normal;color:#aaa;font-size:10px;text-transform:none;">Clean grant — zero internal notes</span>
        </div>

        ${inputRequiredBanner}

        <div class="score-box">
          ${scoreDisplay}
        </div>

        ${createDocButton}
        ${docLink}
        ${approveButton}

        <div style="margin-top:20px;">
          ${clientGrantPanel}
        </div>
      </div>

      <!-- RIGHT: Internal QA Report -->
      <div class="panel">
        <div class="panel-label qa-label">
          <span>Internal QA Report</span>
          <span style="font-weight:normal;color:#aaa;font-size:10px;text-transform:none;">Never sent to client</span>
        </div>
        ${qaPanel}
      </div>

    </div>
  </div>

  <script>
    async function deliverSubmission(id) {
      const btn = document.getElementById('deliver-btn');
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = 'Delivering\u2026';

      try {
        const res  = await fetch('/admin/submission/' + id + '/mark-delivered', { method: 'POST' });
        const data = await res.json();

        if (!res.ok) {
          alert(data.error || 'Delivery failed. Please try again.');
          btn.disabled = false;
          btn.textContent = 'Approve & Mark Delivered';
          return;
        }

        const deliveredDate = new Date(data.deliveredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        btn.outerHTML = '<div style="width:100%;background:#e2e3e5;color:#41464b;padding:12px 20px;border-radius:5px;font-size:14px;font-family:Georgia,serif;font-weight:bold;margin-top:8px;text-align:center;">\u2713 Delivered ' + deliveredDate + '</div>';

        if (!data.emailSent) {
          alert('Marked as delivered, but the delivery email failed to send. Please email the client manually.');
        }
      } catch (err) {
        alert('Network error. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Approve & Mark Delivered';
      }
    }
  </script>
</body>
</html>`);
});

// Create Google Doc for a submission
app.post('/admin/submission/:id/create-doc', async (req, res) => {
  const submission = await getSubmission(req.params.id);

  if (!submission) return res.status(404).send('Submission not found.');

  try {
    console.log(`Creating Google Doc for submission ${req.params.id}...`);
    const { docUrl, docId, clientFolderId } = await createGrantDoc(submission);

    await updateSubmission(req.params.id, {
      doc_url:          docUrl,
      doc_id:           docId,
      client_folder_id: clientFolderId,
      doc_created_at:   new Date().toISOString(),
    });

    console.log(`Google Doc created: ${docUrl}`);
    return res.redirect(`/admin/submission/${req.params.id}`);
  } catch (err) {
    console.error('Google Doc creation failed:', err);
    return res.status(500).send(`
      <p style="font-family:Georgia,serif;padding:40px;color:#842029;">
        <strong>Google Doc creation failed:</strong><br><br>
        <code style="background:#f8d7da;padding:12px;display:block;white-space:pre-wrap;">${err.message}</code>
        <br><a href="/admin/submission/${req.params.id}" style="color:#2a6049;">← Back</a>
      </p>
    `);
  }
});

app.post('/admin/submission/:id/mark-delivered', async (req, res) => {
  const submission = await getSubmission(req.params.id);

  if (!submission) {
    return res.status(404).json({ success: false, error: 'Submission not found.' });
  }

  if (!submission.doc_url) {
    return res.status(400).json({
      success: false,
      error: 'Cannot deliver: Google Doc has not been created yet. Please create the Google Doc first.',
    });
  }

  // Idempotency guard — do not re-deliver
  if (submission.status === 'delivered') {
    return res.json({
      success: true,
      delivered: true,
      emailSent: false,
      deliveredAt: submission.delivered_at,
    });
  }

  // Export as Word doc if that's what the client requested
  let docxBuffer = null;
  if (submission.delivery_format === 'word' && submission.doc_id) {
    try {
      docxBuffer = await exportDocAsDocx(submission.doc_id);
    } catch (err) {
      console.error(`Word export failed for submission ${req.params.id}:`, err.message);
      // Fall through — email will still send with Google Doc link
    }
  }

  const deliveredAt = new Date().toISOString();

  let emailSent = false;
  try {
    await sendDeliveryEmail(submission, docxBuffer);
    emailSent = true;
  } catch (err) {
    console.error(`Delivery email failed for submission ${req.params.id}:`, err.message);
    // Email failure does not block the status update
  }

  await updateSubmission(req.params.id, {
    status:       'delivered',
    delivered_at: deliveredAt,
  });

  console.log(`Submission ${req.params.id} marked as delivered. Email sent: ${emailSent}`);

  res.json({ success: true, delivered: true, emailSent, deliveredAt });
});

app.listen(PORT, () => {
  console.log(`Wellspring Grants is running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});
