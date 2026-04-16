const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic();

// Try to fetch the grant guidelines page and extract readable text
async function fetchGuidelinesText(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WellspringGrants/1.0)' }
    });
    const html = await response.text();
    // Strip HTML tags and collapse whitespace
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    // Cap at 3000 characters to avoid overloading the prompt
    return text.slice(0, 3000);
  } catch {
    return null;
  }
}

// Build the prompt Claude will use to write the grant
function buildPrompt(submission, guidelinesText) {
  const amountFormatted = `$${Number(submission.amount_requested).toLocaleString()}`;
  const budgetFormatted = submission.annual_budget ? `$${Number(submission.annual_budget).toLocaleString()}` : null;

  const funderContext = guidelinesText
    ? `Here is text pulled from the funder's grant guidelines page:\n\n"${guidelinesText}"\n\nBefore writing, extract the funder's top 3 stated priorities from this text and list them explicitly at the top of your Funder Priority Alignment section (see post-grant instructions below). Use the funder's own language. Each major section — Statement of Need, Project Description, and Goals and Objectives — must explicitly reference at least one of these priorities using the funder's own words.`
    : `⚠️ FLAG: No guidelines URL was successfully fetched. Note this at the top of the Funder Priority Alignment section. Use your knowledge of ${submission.funder_name} and the grant program "${submission.grant_program}" to align the application as best as possible, but flag that human review of funder alignment is required.`;

  const specialReqs = submission.special_requirements
    ? `The funder has the following special requirements — follow them precisely:\n${submission.special_requirements}`
    : 'No special formatting requirements were provided. Use standard grant writing structure.';

  return `You are an expert grant writer with 20 years of experience helping small nonprofits secure community foundation funding. Your writing is clear, compelling, specific, and donor-focused — never vague or generic.

---

BANNED WORDS — NEVER USE ANY OF THESE ANYWHERE IN THIS GRANT
The following are flagged by experienced grant reviewers as filler language. They must not appear anywhere in the document, headers, or body:
"empower" / "holistic" / "synergy" / "leverage" (as a verb) / "impactful" / "learnings" / "stakeholders"
Replace every instance with specific, concrete language drawn directly from the intake form details.

---

LOCKED DATA — THESE NUMBERS MUST APPEAR EXACTLY AS WRITTEN. DO NOT ROUND, PARAPHRASE, OR ALTER.
Amount Requested: ${amountFormatted} — this exact figure must appear identically in the document header, executive summary, budget table, and budget total line. If any instance differs, halt and correct before continuing.
${budgetFormatted ? `Annual Operating Budget: ${budgetFormatted} — this exact figure must appear identically wherever referenced. Add a note to the Before You Submit checklist: "Confirm this matches your organization's most recent 990 or financial statement."` : 'Annual Operating Budget: Not provided — do not invent this figure.'}

---

FUNDER INFORMATION
Funder: ${submission.funder_name}
Grant Program: ${submission.grant_program}
Amount Requested: ${amountFormatted}
Application Deadline: ${submission.grant_deadline}

${funderContext}

---

ORGANIZATION INFORMATION
Organization: ${submission.org_name}
Location: ${submission.org_location}
501(c)(3) Status: ${submission.tax_exempt}
Mission: ${submission.mission}
${budgetFormatted ? `Annual Operating Budget: ${budgetFormatted}` : ''}

---

PROJECT INFORMATION
The Problem: ${submission.problem_statement}

Project Description: ${submission.project_description}

Who We Serve: ${submission.target_population}

Expected Outcomes: ${submission.expected_outcomes}

Budget Breakdown: ${submission.budget_breakdown}

---

SPECIAL REQUIREMENTS
${specialReqs}

---

Additional context from the applicant: ${submission.anything_else || 'None provided.'}

---

MANDATORY WRITING RULES — APPLY TO EVERY SECTION

1. HUMAN STORY OPENING: The Executive Summary must open with one single anonymized sentence showing the human reality of this problem BEFORE any statistics or organizational description. The sentence should put the reader in the room with a real beneficiary. Example format: "Last spring, a ninth-grader in South Austin failed her algebra final — not because she didn't study, but because she had no one to study with." Write a sentence specific to this organization's work — do not copy this example.

2. AMOUNT LOCK: ${amountFormatted} must appear identically in the header, executive summary, budget table, and budget total. Before moving to post-grant sections, confirm all four instances match exactly.

3. BUDGET MATH: Add up every line item in the budget breakdown. The sum must equal ${amountFormatted} exactly. If it is off by even $1, halt, show your math, and correct it before continuing.

4. NO BANNED WORDS: Scan your output before finalizing. If any banned word appears, rewrite that sentence.

5. FUNDER MIRRORING: The Statement of Need, Project Description, and Goals and Objectives sections must each reference at least one of the funder's stated priorities using the funder's own language — not paraphrased.

6. FUNDER HISTORY ALIGNMENT: If the funder guidelines reference past recipients, previously funded programs, or stated funding priorities, confirm this application fits that pattern before writing. If the organization's work is misaligned with the funder's history, flag it in bold at the top of the Funder Priority Alignment section before proceeding.

7. LOGIC MODEL VERIFICATION: Before finalizing the Project Description, verify this chain is explicitly traceable in the text: Need → Activity → Output → Outcome → Impact. Each link must be present and connected. If any link is missing or implied but not stated, add it before finalizing that section.

8. SPECIFICITY SCAN: After drafting all sections, find every instance of "many," "several," "some," and "various" in the document. Replace each with an actual number from the intake form. If no specific number exists in the intake form for that instance, flag it as: ⚠️ NEEDS SPECIFIC NUMBER — human to complete.

9. TENSE CONSISTENCY: Future program activities must be written in future tense. Organizational history and past achievements must be written in past tense. Scan each paragraph — if both tenses appear within a single paragraph without logical justification, flag the paragraph and correct it.

10. OUTCOME MEASUREMENT PAIRING: Every stated outcome in the Goals and Objectives and Evaluation Plan sections must have exactly one corresponding measurement method stated in the same section (e.g., a specific data source, survey, report, or tracking tool). If any outcome lacks a paired measurement method, flag it as: ⚠️ OUTCOME MISSING MEASUREMENT METHOD.

11. COLD READ DIFFERENTIATION TEST: After completing the full grant, answer this question in exactly one sentence: "Why should THIS funder choose THIS organization over all other applicants?" The answer must be drawn from specific details in this document — not generic claims. If the answer is not immediately obvious from the narrative, flag it as: ⚠️ DIFFERENTIATION WEAK — narrative needs strengthening before delivery.

12. REQUEST-TO-BUDGET RATIO CHECK: Calculate (Amount Requested ÷ Annual Operating Budget) × 100. ${budgetFormatted ? `For this application: (${amountFormatted} ÷ ${budgetFormatted}) × 100. If the result exceeds 30%, flag it as: ⚠️ REQUEST EXCEEDS 30% OF OPERATING BUDGET — consider reducing the ask or adding a note about organizational funding diversity.` : `Annual operating budget was not provided — skip this calculation and note in the Before You Submit checklist that the ratio check could not be completed.`}

13. REPETITION SCAN: Scan the full document for any phrase, statistic, or sentence appearing more than once. Remove all duplicates. For each section where repetition was found and removed, flag it as: ⚠️ REPETITION REMOVED IN [SECTION NAME] — review for flow.

14. WORD COUNT COMPLIANCE: For every section that has a stated word or page limit in the Special Requirements field, output the actual word count in brackets immediately after that section header, formatted as: [WORD COUNT: 247 / 250 max]. If no special requirements were provided, skip this rule. Flag any section that meets or exceeds its limit as: ⚠️ AT OR OVER LIMIT — trim before submission.

15. GRANT READINESS FLAG: At the very top of the Before You Submit — Placeholder Checklist, before any other items, add this block exactly as written:

REQUIRED ATTACHMENTS — confirm before submitting:
☐ IRS 501(c)(3) determination letter
☐ Most recent Form 990
☐ Current board of directors list
☐ Most recent financial statements
☐ Any additional attachments specified by funder

---

Write the following sections in order. Use the section headers exactly as written. Write in first person plural ("we", "our organization"). Be specific — use the numbers and details provided. Do not invent facts not in the intake form.

## Executive Summary
(150–200 words. MUST open with one anonymized human story sentence. Then: the problem, our organization, the project, and the ask of ${amountFormatted}.)

## Organizational Background
(200–300 words. Establish credibility — mission, community role, years of operation, capacity to deliver.)

## Statement of Need
(250–400 words. Make the case for why this problem matters and why it is urgent. Use the data and examples provided. Reference at least one funder priority explicitly.)

## Project Description
(350–500 words. Explain exactly what will be done, how, and on what timeline. Reference at least one funder priority explicitly.)

## Goals and Objectives
(Clear list format. 2–3 goals, each with 1–2 measurable objectives tied to the expected outcomes provided. Reference at least one funder priority explicitly.)

## Evaluation Plan
(150–250 words. How will success be measured? Who tracks it, how often, and what tools will be used?)

## Budget Narrative
(Itemize each line from the budget breakdown. Connect each cost to a specific activity. End with a total line confirming the sum equals ${amountFormatted}.)

## Sustainability Plan
(150–200 words. How will this work continue after the grant period ends? Be specific — name revenue sources, partnerships, or capacity-building plans.)

---

AFTER COMPLETING THE GRANT BODY, OUTPUT ALL FIVE OF THE FOLLOWING SECTIONS IN FULL. THESE ARE NOT OPTIONAL.

---

## Funder Priority Alignment
List the top 3 priorities you identified from the funder's guidelines using their exact language. For each, note which grant section references it and quote the specific sentence you used.

If no guidelines were available: flag this in bold and note which sections need human review for funder alignment.

---

## Funding Case Stress Test
Write a 3-sentence summary (maximum) capturing the single strongest possible case for why this funder should fund this organization over all others. Be ruthlessly specific — use numbers, outcomes, and community context from the intake form.

If this summary was difficult to write clearly and compellingly, add this flag in bold: ⚠️ NARRATIVE NEEDS STRENGTHENING — review before delivery.

---

## AI Detection Review
Identify the 5 most generic, vague, or AI-sounding sentences in the grant body above. For each, show:
ORIGINAL: [the sentence as written]
REVISED: [rewritten with specific details from the intake form]

Focus on sentences that could have been written about any nonprofit. Replace with language only true of this specific organization.

---

## Budget Math Verification
List every line item from the budget breakdown with its dollar amount as you interpreted it. Sum them. Confirm the total equals ${amountFormatted} exactly.

If the total does not match: ⚠️ HALT — show the discrepancy, identify which line item is the source of the error, and correct the Budget Narrative above before this section.

---

## Data Consistency Audit
List every specific number in the full document — dollar amounts, student counts, dates, percentages, frequencies. For each, confirm it matches the intake form exactly.

Format each line as: ✓ [number] — matches intake / ⚠️ MISMATCH: [describe discrepancy]

Then output a separate subsection:

### Before You Submit — Placeholder Checklist
List every field a human must complete or verify before submitting this application. This must include at minimum: EIN, authorized signer name and title, phone number, board member names (if referenced), submission date, and any funder-portal-specific fields. Flag any that were left as placeholders in the document body.`;
}

// Update a submission in submissions.json with the generated grant
function saveGrantDraft(submissionId, grantText) {
  const filePath = path.join(__dirname, 'data', 'submissions.json');
  const submissions = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const index = submissions.findIndex(s => s.id === submissionId);
  if (index !== -1) {
    submissions[index].grant_draft = grantText;
    submissions[index].grant_generated_at = new Date().toISOString();
    submissions[index].status = 'draft_ready';
    fs.writeFileSync(filePath, JSON.stringify(submissions, null, 2));
    console.log(`Grant draft saved for submission ${submissionId}`);
  }
}

// Main function — called from server.js after a form submission is saved
async function generateGrant(submission) {
  console.log(`\nGenerating grant for: ${submission.org_name} (ID: ${submission.id})`);

  try {
    const guidelinesText = await fetchGuidelinesText(submission.guidelines_url);

    if (guidelinesText) {
      console.log('Guidelines fetched successfully.');
    } else {
      console.log('Could not fetch guidelines URL — proceeding without it.');
    }

    const prompt = buildPrompt(submission, guidelinesText);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    });

    const grantText = message.content[0].text;
    saveGrantDraft(submission.id, grantText);
    console.log(`Grant generation complete for submission ${submission.id}`);

  } catch (err) {
    console.error(`Grant generation failed for submission ${submission.id}:`, err.message);

    // Save the error state so the admin dashboard can show it
    const filePath = path.join(__dirname, 'data', 'submissions.json');
    if (fs.existsSync(filePath)) {
      const submissions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const index = submissions.findIndex(s => s.id === submission.id);
      if (index !== -1) {
        submissions[index].status = 'generation_failed';
        submissions[index].error = err.message;
        fs.writeFileSync(filePath, JSON.stringify(submissions, null, 2));
      }
    }
  }
}

module.exports = { generateGrant };
