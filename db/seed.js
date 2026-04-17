require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createSubmission } = require('./queries');
const { pool }             = require('./index');

const fixtures = [

  // ── Fixture 1: Bright Futures Learning Center ──────────────────────────────
  // Status: draft_ready — represents a paid, generated submission ready for
  // admin review. Use this to test the admin detail view, Google Doc creation,
  // and the "Approve & Mark Delivered" flow.
  {
    id:                   'fixture-bright-futures-001',
    submitted_at:         new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    paid_at:              new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status:               'draft_ready',
    org_name:             'Bright Futures Learning Center',
    mission:              'We provide free after-school tutoring, mentorship, and college prep support to underserved youth in South Austin to close the opportunity gap and increase high school graduation rates.',
    ein:                  '83-1234567',
    signer_name:          'Maria Rodriguez',
    signer_title:         'Executive Director',
    org_phone:            '512-555-0142',
    org_street:           '4821 S Congress Ave',
    org_city:             'Austin',
    org_state:            'TX',
    org_zip:              '78745',
    org_location:         'Austin, TX',
    tax_exempt:           'Yes',
    funder_name:          'H-E-B Excellence in Education Foundation',
    grant_program:        'Community Impact Grant 2025',
    guidelines_url:       'https://www.heb.com/heb-foundation/grants',
    grant_deadline:       '2025-06-30',
    amount_requested:     28000,
    annual_budget:        195000,
    budget_breakdown:     '$14,000 — tutor salaries; $6,000 — SAT prep curriculum; $5,500 — 15 refurbished laptops; $1,500 — transportation and snacks; $1,000 — program evaluation',
    problem_statement:    "In South Austin's 78745 zip code, 68% of students qualify for free or reduced lunch, yet only 41% graduate college-ready. Private tutoring averages $80/hour — out of reach for these families.",
    project_description:  'Hire two part-time tutors, expand to three evenings per week, launch Saturday SAT prep for 30 juniors, purchase 15 refurbished laptops.',
    target_population:    'Middle and high school students grades 6-12 in 78745 and 78748 zip codes. 85% qualify for free or reduced lunch. 60% English language learners.',
    expected_outcomes:    'Serve 150 students (25% increase); 80% on-time graduation rate; 30 seniors complete college apps; 90-point average SAT score increase',
    delivery_format:      'Google Doc',
    contact_name:         'Jamie Okonkwo',
    contact_email:        'jamie@brightfuturesatx.org',
    referral_source:      'ProPublica research',
    quality_score:        8.9,
    grant_body:           '[FIXTURE — run grant generation to populate]',
    qa_report:            '[FIXTURE — run grant generation to populate]',
    client_input_required: false,
  },

  // ── Fixture 2: Riverside Youth Arts Collective ─────────────────────────────
  // Status: pending_payment — represents a form submission that has not yet
  // paid. Use this to test the admin dashboard's "Awaiting Payment" badge and
  // confirm the row appears but no generation buttons are shown.
  {
    id:           'fixture-riverside-001',
    submitted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status:       'pending_payment',
    org_name:     'Riverside Youth Arts Collective',
    mission:      'We bring visual and performing arts education to underserved youth in Riverside County.',
    ein:          '95-9876543',
    signer_name:  'Alex Chen',
    signer_title: 'Artistic Director',
    org_phone:    '951-555-0234',
    org_street:   '1200 Magnolia Ave',
    org_city:     'Riverside',
    org_state:    'CA',
    org_zip:      '92507',
    org_location: 'Riverside, CA',
    tax_exempt:   'Yes',
    funder_name:  'National Endowment for the Arts',
    grant_program: 'Youth Arts Access',
    amount_requested: 15000,
    annual_budget:    85000,
    contact_name:  'Alex Chen',
    contact_email: 'director@riversideyoutharts.org',
    delivery_format: 'Word',
  },

  // ── Fixture 3: Green Valley Food Pantry ────────────────────────────────────
  // Status: input_required — represents a submission where the grant engine
  // could not reach the 8.6 quality score threshold due to thin intake data.
  // Use this to test the "Client Input Required" banner, the amber badge, the
  // QA report panel, and the gap questions workflow.
  {
    id:                   'fixture-green-valley-001',
    submitted_at:         new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    status:               'input_required',
    org_name:             'Green Valley Food Pantry',
    mission:              'We provide emergency food assistance and nutrition education to families facing food insecurity.',
    ein:                  '77-5544332',
    signer_name:          'Robert Kim',
    signer_title:         'Director',
    org_phone:            '602-555-0891',
    org_street:           '450 E Main St',
    org_city:             'Mesa',
    org_state:            'AZ',
    org_zip:              '85201',
    org_location:         'Mesa, AZ',
    tax_exempt:           'Yes',
    funder_name:          'Local Community Foundation',
    grant_program:        'Emergency Relief Fund',
    amount_requested:     8000,
    annual_budget:        42000,
    problem_statement:    'Food insecurity affects our community.',
    project_description:  'Expand pantry hours and add mobile distribution.',
    target_population:    'Low-income families',
    expected_outcomes:    'Serve more families',
    budget_breakdown:     '$5,000 — food purchases; $3,000 — van rental',
    contact_name:         'Robert Kim',
    contact_email:        'info@gvfoodpantry.org',
    delivery_format:      'Google Doc',
    client_input_required: true,
    quality_score:        7.2,
    qa_report:            'GAP 1: Problem Statement\nWhat\'s missing: No statistics provided about food insecurity in service area.\nWhy it matters: Funders require evidence of need.\nWhat to ask: How many households does your pantry serve monthly? What percentage are below the poverty line in your service area?\n\nGAP 2: Expected Outcomes\nWhat\'s missing: No measurable targets or metrics.\nWhy it matters: Cannot evaluate project success without numbers.\nWhat to ask: How many families do you currently serve? What is your target increase?',
  },

];

async function seed() {
  let inserted = 0;
  let skipped  = 0;

  for (const fixture of fixtures) {
    try {
      await createSubmission(fixture);
      console.log(`  Inserted  ${fixture.org_name}`);
      inserted++;
    } catch (err) {
      if (err.code === '23505') {
        console.log(`  Skipped   ${fixture.org_name} — already exists`);
        skipped++;
      } else {
        console.error(`  Failed    ${fixture.org_name} — ${err.message}`);
        await pool.end();
        process.exit(1);
      }
    }
  }

  console.log(`\nSeed complete. Inserted: ${inserted} | Skipped: ${skipped}`);
  await pool.end();
}

seed().catch(err => {
  console.error('Seed script failed:', err.message);
  process.exit(1);
});
