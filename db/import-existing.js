// One-time import of data/submissions.json into Postgres.
// Safe to run multiple times — uses ON CONFLICT DO NOTHING.
// Maps both old camelCase field names and new snake_case field names.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs   = require('fs');
const path = require('path');
const pool = require('./pool');

async function importExisting() {
  const jsonPath = path.join(__dirname, '..', 'data', 'submissions.json');

  if (!fs.existsSync(jsonPath)) {
    console.log('No data/submissions.json found — nothing to import.');
    await pool.end();
    return;
  }

  const records = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Found ${records.length} record(s) in submissions.json.`);

  let inserted = 0;
  let skipped  = 0;
  let failed   = 0;

  for (const r of records) {
    // Map old camelCase names → snake_case DB columns.
    // Fall back to snake_case versions in case the record was already converted.
    const data = {
      id:                   String(r.id),
      submitted_at:         r.submittedAt         || r.submitted_at         || null,
      status:               r.status              || 'pending_payment',
      org_name:             r.org_name            || null,
      mission:              r.mission             || null,
      ein:                  r.ein                 || null,
      signer_name:          r.signer_name         || null,
      signer_title:         r.signer_title        || null,
      org_phone:            r.org_phone           || null,
      org_street:           r.org_street          || null,
      org_city:             r.org_city            || null,
      org_state:            r.org_state           || null,
      org_zip:              r.org_zip             || null,
      org_location:         r.org_location        || null,
      tax_exempt:           r.tax_exempt          || null,
      funder_name:          r.funder_name         || null,
      grant_program:        r.grant_program       || null,
      guidelines_url:       r.guidelines_url      || null,
      grant_deadline:       r.grant_deadline      || null,
      special_requirements: r.special_requirements || null,
      problem_statement:    r.problem_statement   || null,
      project_description:  r.project_description || null,
      target_population:    r.target_population   || null,
      expected_outcomes:    r.expected_outcomes   || null,
      budget_breakdown:     r.budget_breakdown    || null,
      amount_requested:     r.amount_requested    || null,
      annual_budget:        r.annual_budget       || null,
      delivery_format:      r.delivery_format     || null,
      contact_name:         r.contact_name        || null,
      contact_email:        r.contact_email       || null,
      referral_source:      r.referral_source     || null,
      anything_else:        r.anything_else       || null,
      stripe_session_id:    r.stripeSessionId     || r.stripe_session_id    || null,
      paid_at:              r.paidAt              || r.paid_at              || null,
      grant_draft:          r.grant_draft         || null,
      grant_body:           r.grant_body          || null,
      qa_report:            r.qa_report           || null,
      quality_score:        r.quality_score       || null,
      client_input_required: r.client_input_required || false,
      grant_generated_at:   r.grant_generated_at  || null,
      doc_url:              r.docUrl              || r.doc_url              || null,
      doc_id:               r.docId               || r.doc_id               || null,
      client_folder_id:     r.clientFolderId      || r.client_folder_id     || null,
      doc_created_at:       r.docCreatedAt        || r.doc_created_at       || null,
      delivered_at:         r.deliveredAt         || r.delivered_at         || null,
      error:                r.error               || null,
    };

    // Remove null values so we only INSERT columns that have data.
    const keys = Object.keys(data).filter(k => data[k] !== null && data[k] !== undefined);
    const columns     = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values       = keys.map(k => data[k]);

    try {
      const result = await pool.query(
        `INSERT INTO submissions (${columns}) VALUES (${placeholders})
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        values
      );

      if (result.rows.length > 0) {
        console.log(`  Inserted : ${data.id} — ${data.org_name || '(no org name)'}`);
        inserted++;
      } else {
        console.log(`  Skipped  : ${data.id} — already exists`);
        skipped++;
      }
    } catch (err) {
      console.error(`  Failed   : ${data.id} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted} | Skipped: ${skipped} | Failed: ${failed}`);
  await pool.end();
}

importExisting().catch(err => {
  console.error('Import script failed:', err.message);
  process.exit(1);
});
