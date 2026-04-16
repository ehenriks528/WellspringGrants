require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generateGrant } = require('./generateGrant');

const TEST_ID = 9999999999999;

const submission = {
  id: TEST_ID,
  org_name: 'Bright Futures Learning Center',
  mission: 'We provide free after-school tutoring, mentorship, and college prep support to underserved youth in South Austin to close the opportunity gap and increase high school graduation rates.',
  org_location: 'Austin, TX',
  tax_exempt: 'yes',
  funder_name: 'H-E-B Excellence in Education Foundation',
  grant_program: 'Community Impact Grant 2025',
  guidelines_url: 'https://www.heb.com/heb-foundation/grants',
  grant_deadline: '2025-06-30',
  special_requirements: 'Needs statement: 250 words max. Project narrative: 500 words max. Must include a one-page budget summary and a brief sustainability plan (100 words).',
  problem_statement: "In South Austin's 78745 zip code, 68% of students qualify for free or reduced lunch, yet only 41% graduate college-ready. Families in this area lack access to affordable tutoring — private options average $80/hour — leaving low-income students without the academic support their peers take for granted.",
  project_description: 'With this funding, Bright Futures will hire two part-time tutors, extend our program to three evenings per week (up from two), and launch a Saturday SAT prep cohort serving 30 high school juniors. We will also purchase 15 refurbished laptops to support students who lack devices at home. Programming will run September 2025 through August 2026.',
  target_population: 'Middle and high school students (grades 6–12) from low-income households in South Austin, primarily from the 78745 and 78748 zip codes. We currently serve 120 students annually, 85% of whom qualify for free or reduced lunch and 60% of whom are English language learners.',
  expected_outcomes: 'Serve 150 students in the 2025–2026 school year (25% increase); achieve an 80% on-time graduation rate among program participants; 30 seniors complete college applications with our support; average SAT score increase of 90 points among Saturday cohort participants.',
  amount_requested: '28000',
  annual_budget: '195000',
  budget_breakdown: '$14,000 — tutor salaries (2 part-time, 10 hrs/week each for 12 months); $6,000 — SAT prep curriculum and materials; $5,500 — 15 refurbished laptops; $1,500 — snacks and student transportation stipends; $1,000 — program evaluation and reporting.',
  contact_name: 'Jamie Okonkwo',
  contact_email: 'ehenriks528@gmail.com',
  referral_source: 'referral',
  anything_else: 'We received a $10,000 seed grant from the Austin Community Foundation in 2023 and have since tripled our student enrollment. We have an existing relationship with the H-E-B Foundation through their school supply drive partnership, which we have participated in for two years.'
};

const filePath = path.join(__dirname, 'data', 'submissions.json');

async function runTest() {
  // Inject test submission
  const submissions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  submissions.push(submission);
  fs.writeFileSync(filePath, JSON.stringify(submissions, null, 2));

  console.log('Sending Bright Futures to Master Grant Prompt...');
  console.log('Estimated time: 60–90 seconds.\n');

  try {
    await generateGrant(submission);

    const updated = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const result = updated.find(s => s.id === TEST_ID);

    if (result && result.grant_draft) {
      fs.writeFileSync(path.join(__dirname, 'test-output.txt'), result.grant_draft);
      console.log(result.grant_draft);
    } else {
      console.log('ERROR: No grant draft found. Status:', result ? result.status : 'not found');
      if (result && result.error) console.log('Error detail:', result.error);
    }
  } finally {
    const cleanup = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    fs.writeFileSync(filePath, JSON.stringify(cleanup.filter(s => s.id !== TEST_ID), null, 2));
    console.log('\n[Test submission removed from submissions.json]');
  }
}

runTest().catch(err => {
  console.error('Test runner failed:', err.message);
  try {
    const cleanup = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    fs.writeFileSync(filePath, JSON.stringify(cleanup.filter(s => s.id !== TEST_ID), null, 2));
  } catch {}
});
