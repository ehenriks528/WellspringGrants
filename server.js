require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const basicAuth = require('express-basic-auth');
const Stripe = require('stripe');
const { generateGrant } = require('./generateGrant');
const { sendConfirmationEmail } = require('./sendEmail');
const { createGrantDoc } = require('./createDoc');

const app = express();
const PORT = process.env.PORT || 3000;
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Parse form submissions and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (HTML, CSS, images) from the "public" folder
app.use(express.static('public'));

// Password-protect all /admin routes
app.use('/admin', basicAuth({
  users: { admin: process.env.ADMIN_PASSWORD },
  challenge: true,
  realm: 'Wellspring Grants Admin'
}));

// ─── Helper functions ─────────────────────────────────────────────────────────

function loadSubmissions() {
  const filePath = path.join(__dirname, 'data', 'submissions.json');
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveSubmissions(submissions) {
  const filePath = path.join(__dirname, 'data', 'submissions.json');
  fs.writeFileSync(filePath, JSON.stringify(submissions, null, 2));
}

function statusBadge(status) {
  const styles = {
    pending_payment:   'background:#e2e3e5;color:#41464b;',
    generating:        'background:#fff3cd;color:#856404;',
    draft_ready:       'background:#d1e7dd;color:#0a3622;',
    generation_failed: 'background:#f8d7da;color:#842029;',
    delivered:         'background:#cfe2ff;color:#084298;'
  };
  const labels = {
    pending_payment:   'Awaiting Payment',
    generating:        'Generating...',
    draft_ready:       'Draft Ready',
    generation_failed: 'Generation Failed',
    delivered:         'Delivered'
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

function ensureDataDir() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
}

// ─── Public routes ────────────────────────────────────────────────────────────

// Serve intake form at /apply
app.get('/apply', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'apply.html'));
});

// Receive form, save as pending, redirect to Stripe Checkout
app.post('/checkout', async (req, res) => {
  const submission = {
    id: Date.now(),
    submittedAt: new Date().toISOString(),
    status: 'pending_payment',
    ...trimBody(req.body)
  };

  console.log('\n--- New Submission (awaiting payment) ---');
  console.log('From:', submission.contact_name, '<' + submission.contact_email + '>');
  console.log('Org:', submission.org_name);
  console.log('Funder:', submission.funder_name);
  console.log('-----------------------------------------\n');

  ensureDataDir();
  const submissions = loadSubmissions();
  submissions.push(submission);
  saveSubmissions(submissions);

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
      metadata: { submissionId: String(submission.id) },
      success_url: `${process.env.APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/payment-cancelled`,
    });

    res.redirect(303, session.url);
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).send('Payment setup failed. Please try again or contact hello@wellspringgrants.com.');
  }
});

// Stripe redirects here after successful payment
app.get('/payment-success', async (req, res) => {
  const { session_id } = req.query;

  if (!session_id) {
    return res.redirect('/');
  }

  try {
    // Verify the payment actually completed
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.redirect('/payment-cancelled');
    }

    const submissionId = Number(session.metadata.submissionId);
    const submissions = loadSubmissions();
    const index = submissions.findIndex(s => s.id === submissionId);

    if (index !== -1 && submissions[index].status === 'pending_payment') {
      submissions[index].status = 'generating';
      submissions[index].stripeSessionId = session.id;
      submissions[index].paidAt = new Date().toISOString();
      saveSubmissions(submissions);

      console.log(`Payment confirmed for submission ${submissionId}. Starting grant generation.`);
      sendConfirmationEmail(submissions[index]);
      generateGrant(submissions[index]);
    }

    res.redirect('/confirmation.html');
  } catch (err) {
    console.error('Payment verification error:', err.message);
    res.redirect('/confirmation.html'); // Still show confirmation — payment went through
  }
});

// Stripe redirects here if client abandons payment
app.get('/payment-cancelled', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment-cancelled.html'));
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

app.get('/admin', (req, res) => {
  const submissions = loadSubmissions().reverse();

  const rows = submissions.length === 0
    ? `<tr><td colspan="6" style="text-align:center;padding:40px;color:#888;">No submissions yet.</td></tr>`
    : submissions.map(s => `
        <tr>
          <td style="padding:14px 16px;">
            <strong>${s.org_name || '—'}</strong><br>
            <span style="font-size:13px;color:#666;">${s.contact_email || ''}</span>
          </td>
          <td style="padding:14px 16px;">${s.funder_name || '—'}</td>
          <td style="padding:14px 16px;">${s.grant_deadline || '—'}</td>
          <td style="padding:14px 16px;">$${Number(s.amount_requested || 0).toLocaleString()}</td>
          <td style="padding:14px 16px;">${statusBadge(s.status)}</td>
          <td style="padding:14px 16px;">
            <a href="/admin/submission/${s.id}" style="color:#2a6049;font-weight:bold;text-decoration:none;">View →</a>
          </td>
        </tr>`).join('');

  const counts = submissions.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

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
        <div class="stat-label">Ready</div>
      </div>
      <div class="stat">
        <div class="stat-number">${counts.generating || 0}</div>
        <div class="stat-label">Generating</div>
      </div>
      <div class="stat">
        <div class="stat-number">${counts.delivered || 0}</div>
        <div class="stat-label">Delivered</div>
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

app.get('/admin/submission/:id', (req, res) => {
  const submissions = loadSubmissions();
  const submission = submissions.find(s => s.id === Number(req.params.id));

  if (!submission) return res.status(404).send('Submission not found.');

  const draftSection = submission.grant_draft
    ? `<div id="grant-draft" style="background:#fafaf8;border:1px solid #e8e4dc;border-radius:6px;padding:32px 36px;line-height:1.8;font-size:15px;"></div>
       <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
       <script>document.getElementById('grant-draft').innerHTML = marked.parse(${JSON.stringify(submission.grant_draft)});</script>`
    : `<div style="padding:40px;text-align:center;color:#888;background:#fafaf8;border:1px solid #e8e4dc;border-radius:6px;">
         ${submission.status === 'generating' ? 'Grant is still generating — refresh in a moment.' : 'No draft available.'}
       </div>`;

  const createDocButton = submission.status === 'draft_ready' && !submission.docUrl
    ? `<form method="POST" action="/admin/submission/${submission.id}/create-doc" style="display:inline;">
         <button type="submit" style="background:#2a6049;color:white;border:none;padding:10px 20px;border-radius:5px;font-size:14px;font-family:Georgia,serif;cursor:pointer;font-weight:bold;">Create Google Doc</button>
       </form>`
    : '';

  const docLink = submission.docUrl
    ? `<a href="${submission.docUrl}" target="_blank" style="background:#fff;border:2px solid #2a6049;color:#2a6049;padding:9px 18px;border-radius:5px;font-size:14px;font-family:Georgia,serif;font-weight:bold;text-decoration:none;display:inline-block;">Open Google Doc ↗</a>`
    : '';

  const deliverButton = submission.status === 'draft_ready' && submission.docUrl
    ? `<form method="POST" action="/admin/submission/${submission.id}/mark-delivered" style="display:inline;">
         <button type="submit" style="background:#084298;color:white;border:none;padding:10px 20px;border-radius:5px;font-size:14px;font-family:Georgia,serif;cursor:pointer;font-weight:bold;">Mark as Delivered</button>
       </form>`
    : submission.status === 'delivered'
      ? `<span style="color:#084298;font-weight:bold;font-size:14px;">Delivered</span>`
      : '';

  const actionButtons = `<div style="display:flex;gap:10px;align-items:center;">${createDocButton}${docLink}${deliverButton}</div>`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${submission.org_name} — Wellspring Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; background: #f4f1eb; color: #2c2c2c; padding: 40px 24px; }
    .container { max-width: 860px; margin: 0 auto; }
    .back { color: #2a6049; text-decoration: none; font-size: 14px; display: inline-block; margin-bottom: 24px; }
    .back:hover { text-decoration: underline; }
    .top-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    h1 { font-size: 24px; color: #1a1a1a; margin-bottom: 6px; }
    .meta { font-size: 14px; color: #666; line-height: 1.7; }
    .section { background: #fff; border-radius: 8px; padding: 28px 32px; margin-bottom: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #2a6049; font-weight: bold; margin-bottom: 16px; }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 32px; }
    .field label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #999; font-weight: bold; display: block; margin-bottom: 4px; }
    .field p { font-size: 14px; color: #2c2c2c; line-height: 1.6; }
    .field-full { grid-column: 1 / -1; }
    #grant-draft h2 { font-size: 18px; color: #2a6049; margin: 28px 0 12px; border-bottom: 1px solid #e8e4dc; padding-bottom: 6px; }
    #grant-draft h2:first-child { margin-top: 0; }
    #grant-draft p { margin-bottom: 14px; }
    #grant-draft ul, #grant-draft ol { margin: 0 0 14px 24px; }
    #grant-draft li { margin-bottom: 6px; }
    #grant-draft strong { color: #1a1a1a; }
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
          Submitted ${new Date(submission.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          &nbsp;·&nbsp; ${submission.contact_name} &lt;${submission.contact_email}&gt;
          ${submission.paidAt ? `&nbsp;·&nbsp; Paid ${new Date(submission.paidAt).toLocaleDateString()}` : ''}
        </div>
      </div>
      <div style="padding-top:4px;">${actionButtons}</div>
    </div>
    <div class="section">
      <div class="section-title">Submission Details</div>
      <div class="field-grid">
        <div class="field"><label>Funder</label><p>${submission.funder_name || '—'}</p></div>
        <div class="field"><label>Grant Program</label><p>${submission.grant_program || '—'}</p></div>
        <div class="field"><label>Amount Requested</label><p>$${Number(submission.amount_requested || 0).toLocaleString()}</p></div>
        <div class="field"><label>Deadline</label><p>${submission.grant_deadline || '—'}</p></div>
        <div class="field"><label>Location</label><p>${submission.org_location || '—'}</p></div>
        <div class="field"><label>501(c)(3)</label><p>${submission.tax_exempt || '—'}</p></div>
        <div class="field field-full"><label>Guidelines URL</label><p><a href="${submission.guidelines_url}" target="_blank" style="color:#2a6049;">${submission.guidelines_url || '—'}</a></p></div>
        <div class="field field-full"><label>Special Requirements</label><p>${submission.special_requirements || 'None provided.'}</p></div>
        <div class="field field-full"><label>Problem Statement</label><p>${submission.problem_statement || '—'}</p></div>
        <div class="field field-full"><label>Project Description</label><p>${submission.project_description || '—'}</p></div>
        <div class="field field-full"><label>Target Population</label><p>${submission.target_population || '—'}</p></div>
        <div class="field field-full"><label>Expected Outcomes</label><p>${submission.expected_outcomes || '—'}</p></div>
        <div class="field field-full"><label>Budget Breakdown</label><p>${submission.budget_breakdown || '—'}</p></div>
        <div class="field field-full"><label>Anything Else</label><p>${submission.anything_else || 'None.'}</p></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Grant Draft
        ${submission.grant_generated_at ? `<span style="font-weight:normal;color:#aaa;margin-left:8px;">Generated ${new Date(submission.grant_generated_at).toLocaleString()}</span>` : ''}
      </div>
      ${draftSection}
    </div>
  </div>
</body>
</html>`);
});

// Create Google Doc for a submission
app.post('/admin/submission/:id/create-doc', async (req, res) => {
  const submissions = loadSubmissions();
  const index = submissions.findIndex(s => s.id === Number(req.params.id));

  if (index === -1) return res.status(404).send('Submission not found.');

  try {
    console.log(`Creating Google Doc for submission ${req.params.id}...`);
    const { docUrl, docId, clientFolderId } = await createGrantDoc(submissions[index]);

    submissions[index].docUrl = docUrl;
    submissions[index].docId = docId;
    submissions[index].clientFolderId = clientFolderId;
    submissions[index].docCreatedAt = new Date().toISOString();
    saveSubmissions(submissions);

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

app.post('/admin/submission/:id/mark-delivered', (req, res) => {
  const submissions = loadSubmissions();
  const index = submissions.findIndex(s => s.id === Number(req.params.id));
  if (index !== -1) {
    submissions[index].status = 'delivered';
    submissions[index].deliveredAt = new Date().toISOString();
    saveSubmissions(submissions);
    console.log(`Submission ${req.params.id} marked as delivered.`);
  }
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log(`Wellspring Grants is running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});
