const Anthropic = require('@anthropic-ai/sdk');
const { getSubmission, updateSubmission } = require('./db');

const client = new Anthropic();

// Try to fetch the grant guidelines page and extract readable text
async function fetchGuidelinesText(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WellspringGrants/1.0)' }
    });
    const html = await response.text();
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.slice(0, 3000);
  } catch {
    return null;
  }
}

// Build the full prompt Claude uses to write, score, revise, and output the grant
function buildPrompt(submission, guidelinesText) {
  const amountFormatted = `$${Number(submission.amount_requested).toLocaleString()}`;
  const budgetFormatted = submission.annual_budget ? `$${Number(submission.annual_budget).toLocaleString()}` : null;

  const funderContext = guidelinesText
    ? `Here is text pulled from the funder's grant guidelines page:\n\n"${guidelinesText}"\n\nBefore writing, extract the funder's top 3 stated priorities from this text and list them in the QA Report's Funder Priority Alignment section. Use the funder's own language. Each major section — Statement of Need, Project Description, and Goals and Objectives — must explicitly reference at least one of these priorities using the funder's own words.`
    : `⚠️ FLAG: No guidelines URL was successfully fetched. Note this in the QA Report. Use your knowledge of ${submission.funder_name} and the grant program "${submission.grant_program}" to align the application as best as possible, but flag that human review of funder alignment is required.`;

  const specialReqs = submission.special_requirements
    ? `The funder has the following special requirements — follow them precisely:\n${submission.special_requirements}`
    : 'No special formatting requirements were provided. Use standard grant writing structure.';

  const signerBlock = `
Authorized Signer: ${submission.signer_name || '[ENTER AUTHORIZED SIGNER NAME]'}
Title: ${submission.signer_title || '[ENTER TITLE]'}
Organization: ${submission.org_name}
Date: ___________________________
EIN: ${submission.ein || '[ENTER EIN]'}`;

  return `You are an expert grant writer with 20 years of experience helping small nonprofits secure community foundation funding. Your writing is clear, compelling, specific, and donor-focused — never vague or generic.

---

BANNED WORDS — NEVER USE THESE ANYWHERE IN THIS GRANT
"empower" / "holistic" / "synergy" / "leverage" (as a verb) / "impactful" / "learnings" / "stakeholders"
Replace every instance with specific, concrete language drawn directly from the intake form.

---

LOCKED DATA — DO NOT ROUND, PARAPHRASE, OR ALTER THESE NUMBERS
Amount Requested: ${amountFormatted} — must appear identically in the executive summary, budget table, and budget total.
${budgetFormatted ? `Annual Operating Budget: ${budgetFormatted} — must appear identically wherever referenced.` : 'Annual Operating Budget: Not provided — do not invent this figure.'}

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
City / State: ${submission.org_city || ''}, ${submission.org_state || ''}
ZIP: ${submission.org_zip || ''}
Phone: ${submission.org_phone || 'Not provided'}
EIN: ${submission.ein || 'Not provided'}
Authorized Signer: ${submission.signer_name || 'Not provided'} — ${submission.signer_title || ''}
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

1. HUMAN STORY OPENING: The Executive Summary must open with one single anonymized sentence showing the human reality of this problem BEFORE any statistics or organizational description. The sentence must put the reader in the room with a real beneficiary. Write a sentence specific to this organization's work and location — do not use a generic example.

2. AMOUNT LOCK: ${amountFormatted} must appear identically in the executive summary, budget table, and budget total. Before output, verify all instances match exactly.

3. BUDGET MATH: Add up every line item. The sum must equal ${amountFormatted} exactly. If off by even $1, halt and correct before continuing.

4. NO BANNED WORDS: Scan your output before finalizing. If any banned word appears, rewrite that sentence.

5. FUNDER MIRRORING: Statement of Need, Project Description, and Goals and Objectives must each reference at least one funder priority using the funder's own language.

6. FUNDER HISTORY ALIGNMENT: If guidelines reference past recipients or priorities, confirm this application fits that pattern. If misaligned, flag it in the QA Report.

7. LOGIC MODEL VERIFICATION: Before finalizing Project Description, verify this chain is explicitly traceable: Need → Activity → Output → Outcome → Impact. Each link must be stated, not implied.

8. SPECIFICITY SCAN: Find every instance of "many," "several," "some," and "various" in the grant body. Replace each with an actual number from the intake form. If no specific number exists, write a reasonable estimate and add to QA Report: ⚠️ NEEDS SPECIFIC NUMBER — [section] — human to confirm.

9. TENSE CONSISTENCY: Future activities in future tense. Past achievements in past tense. If both appear in one paragraph without logical justification, correct it.

10. OUTCOME MEASUREMENT PAIRING: Every stated outcome must have exactly one corresponding measurement method in the same section. If any outcome lacks a measurement method, add one and note it in QA Report: ⚠️ MEASUREMENT METHOD ADDED — [section] — confirm this tool is available.

11. COLD READ DIFFERENTIATION TEST: After completing the grant, answer in one sentence: "Why should THIS funder choose THIS organization over all others?" If the answer isn't immediately obvious from the narrative, strengthen the most relevant section before finalizing.

12. REQUEST-TO-BUDGET RATIO CHECK: ${budgetFormatted ? `Calculate (${amountFormatted} ÷ ${budgetFormatted}) × 100. If result exceeds 30%, add to QA Report: ⚠️ REQUEST EXCEEDS 30% OF OPERATING BUDGET.` : 'Annual operating budget not provided — note in QA Report that ratio check could not be completed.'}

13. REPETITION SCAN: Scan for any phrase, statistic, or sentence appearing more than once. Remove all duplicates. Note any in QA Report: ⚠️ REPETITION REMOVED — [section].

14. WORD COUNT COMPLIANCE: If special requirements specify word limits, track each section's word count. Do NOT put word counts in the grant body. List them in the QA Report under Word Count Notes as: [Section — WORD COUNT: X / Y max]. Flag any at or over limit as ⚠️ AT OR OVER LIMIT.

15. GRANT READINESS: Put the following Required Attachments checklist in the QA Report before any other checklist items:
REQUIRED ATTACHMENTS:
☐ IRS 501(c)(3) determination letter
☐ Most recent Form 990
☐ Current board of directors list
☐ Most recent financial statements
☐ Any additional attachments specified by funder

16. EIN LOCK: The EIN must appear in the cover page metadata and the Signature Block. If EIN was not provided, use "[ENTER EIN]" as a placeholder and add to QA Report: ⚠️ EIN MISSING — required before any portal submission.

17. AUTHORIZED SIGNER BLOCK: Every grant must end with a Signature Block section (after Sustainability Plan) containing: Authorized Signer Name, Title, Organization, Date (blank line), and EIN. Pre-fill from intake data. Use "[ENTER NAME]" / "[ENTER TITLE]" / "[ENTER EIN]" for missing fields. List all placeholders in QA Report.

18. OPENING STORY UNIQUENESS TEST: After writing the human story sentence, verify: Could this exact sentence appear in ANY other nonprofit's grant? If yes, rewrite it with a detail that is only true of this specific organization or zip code. If rewritten, note in QA Report: ⚠️ STORY OPENING REVISED FOR SPECIFICITY.

---

CLEAN GRANT BODY RULE — CRITICAL: Every section from Executive Summary through Signature Block must contain ZERO ⚠️ flags, word count brackets, reviewer annotations, or inline notes of any kind. All QA notes must be collected silently and output only inside the <<<QA_REPORT>>> tags. The only acceptable bracket notation in the grant body is placeholder text for missing data like [ENTER EIN].

FORMAT: Use ## for main section headers (→ Heading 1 in Google Doc). Use ### for subsection headers (→ Heading 2). No other markup needed.

---

QUALITY SCORING RUBRIC — Score each dimension 1–10 before finalizing:

DIMENSION 1 — FUNDER ALIGNMENT (weight: 20%)
Does every major section mirror the funder's stated priorities using their own language?
Is the connection between this organization's work and the funder's mission explicit and specific?
Score 9–10: Every section quotes funder language with precision.
Score 7–8: Most sections reference funder priorities. Score below 7: Generic alignment, no direct language mirroring.

DIMENSION 2 — NARRATIVE STRENGTH (weight: 20%)
Does the grant open with a specific human story? Is writing concrete throughout? Are banned words absent? Does each section flow logically into the next?
Score 9–10: Vivid, specific, zero filler. Score 7–8: Mostly specific, minor generic phrases. Below 7: Generic, abstract, or AI-sounding.

DIMENSION 3 — EVIDENCE AND SPECIFICITY (weight: 20%)
Are all claims supported by specific numbers? Are statistics from the intake form or verified sources only? Are vague words absent?
Score 9–10: Every claim has a number. No vague words. Score 7–8: Most claims are specific. Score below 7: Multiple unsupported claims.

DIMENSION 4 — LOGIC MODEL COMPLETENESS (weight: 15%)
Is the full chain traceable: Need → Activity → Output → Outcome → Impact?
Is every outcome paired with a measurement method?
Score 9–10: Chain fully explicit. All outcomes measured. Score 7–8: Chain mostly clear. Score below 7: Missing links.

DIMENSION 5 — BUDGET QUALITY (weight: 15%)
Does every line item connect to a program activity? Does math verify exactly? Is ratio under 30%? Are per-unit costs realistic?
Score 9–10: All items connected, math perfect, ratio reasonable. Score below 7: Items disconnected, math errors, or ratio flagged.

DIMENSION 6 — DIFFERENTIATION (weight: 10%)
Can you answer "why THIS funder should choose THIS org over all others" in one specific sentence using details unique to this submission?
Score 9–10: Answer is immediate and specific. Score 7–8: Answer exists but requires effort. Score below 7: Answer is generic.

WEIGHTED SCORE CALCULATION:
Final Score = (D1×0.20) + (D2×0.20) + (D3×0.20) + (D4×0.15) + (D5×0.15) + (D6×0.10)
Output: GRANT QUALITY SCORE: X.X / 10

---

INSUFFICIENT CONTEXT PROTOCOL — Run before writing:

MINIMUM REQUIREMENTS TO PROCEED:
□ Organization name and mission
□ Specific problem statement with at least 1 statistic
□ Concrete project description
□ Defined target population
□ At least 2 measurable expected outcomes
□ Complete budget breakdown summing to the requested amount

IF ANY REQUIREMENT IS MISSING:
Step 1: Use your training knowledge of this organization (if well-known) or this type of organization and geography to attempt to fill the gap.
Step 2: If you use any information not in the intake form, flag it in the QA Report as:
🌐 WEB-SOURCED: "[claim]" — ⚠️ CONFIRM WITH CLIENT BEFORE SUBMISSION
Step 3: If a gap cannot be filled from your knowledge, proceed with a placeholder and flag in QA Report as: ⚠️ CLIENT INPUT REQUIRED: [section] — [what's missing] — [exact question to ask]

ABSOLUTE PROHIBITION ON FABRICATION:
Under NO circumstances may you invent, estimate, or extrapolate any statistic, dollar amount, outcome claim, population size, or factual assertion that is not present in either:
(a) the client's intake form, or
(b) something verifiable from your training knowledge with a source you can cite
If a fact cannot be sourced, rewrite the sentence to remove the unsupported claim, or flag it as ⚠️ UNVERIFIABLE — client must provide this data.

---

SELF-IMPROVEMENT LOOP — Follow this process before final output:

CYCLE PROCESS:
1. Write the complete grant draft (all sections)
2. Score using the rubric above
3. If score is 8.5 or below AND fewer than 3 cycles have been run:
   a. Identify every dimension scoring below 9.0
   b. Determine whether the gap can be fixed using only intake form data and your knowledge
   c. If fixable: rewrite those specific sections to address every shortcoming
   d. Re-score the revised sections
   e. Return to step 3
4. If score reaches 8.6 or higher, OR 3 cycles are complete: proceed to final output

IF AFTER 3 CYCLES SCORE REMAINS 8.5 OR BELOW:
Do NOT generate output as if the grant is complete.
Instead, put "CLIENT_INPUT_REQUIRED: true" in the QA Report and generate the Client Input Required Report (see format below).

CLIENT INPUT REQUIRED REPORT FORMAT:
─────────────────────────────────────────
GRANT CANNOT BE COMPLETED — CLIENT INPUT REQUIRED
─────────────────────────────────────────
Current Quality Score: X.X / 10
Target Score: 8.6

The following specific information is needed from ${submission.contact_name || submission.org_name} before this grant can be completed to Wellspring standards:

[For each gap, output:]
GAP [N]: [Section Name]
What's missing: [specific description]
Why it matters: [how it affects grant competitiveness]
What to ask the client: "[exact question]"
─────────────────────────────────────────

DRAFT FOLLOW-UP EMAIL:

Subject: A quick question about your grant application

Hi ${submission.contact_name || '[Client Name]'},

Thank you for submitting your grant application for ${submission.funder_name}. We've begun drafting your application and need a few specific details to make it as competitive as possible.

[List only the exact questions from the GAP entries above — no filler]

Please reply to this email with your answers. We'll complete your grant within 48 hours of receiving this information.

Thank you,
Emily
Wellspring Grants
hello@wellspringgrants.com

---

NOW WRITE THE GRANT:

Write the following sections in order. First person plural ("we", "our organization"). Be specific — use numbers and details from the intake form. Do not invent facts.

## Executive Summary
(150–200 words. Open with the human story sentence. Then: the problem, our organization, the project, and the ask of ${amountFormatted}.)

## Organizational Background
(200–300 words. Mission, community role, years of operation, capacity to deliver.)

## Statement of Need
(250–400 words. Why this problem matters, why it is urgent, local data. Reference at least one funder priority explicitly.)

## Project Description
(350–500 words. Exactly what will be done, how, and on what timeline. Reference at least one funder priority explicitly.)

## Goals and Objectives
(List format. 2–3 goals, each with 1–2 measurable objectives tied to the expected outcomes. Reference at least one funder priority explicitly.)

## Evaluation Plan
(150–250 words. How success will be measured, who tracks it, how often, what tools.)

## Budget Narrative
Write one to two sentences connecting the overall budget request to the project's goals. Then format all budget line items as a markdown table using EXACTLY this 3-column structure — no other format is acceptable:

| Line Item | Description | Amount |
|-----------|-------------|--------|
| [item] | [description of activity funded] | [$X,XXX] |

Add a final row: | **TOTAL** | | **${amountFormatted}** |

End with one sentence confirming the total equals ${amountFormatted}.

## Sustainability Plan
(150–200 words. How this work continues after the grant period. Name specific revenue sources, partnerships, or capacity-building plans.)

## Signature Block

${signerBlock}

---

AFTER WRITING THE GRANT, RUN THE QUALITY SCORING AND SELF-IMPROVEMENT LOOP.

THEN OUTPUT YOUR FINAL RESULT USING EXACTLY THIS FORMAT — THE DELIMITER TAGS ARE MANDATORY:

<<<GRANT_BODY_BEGIN>>>
[Final clean grant — Executive Summary through Signature Block — zero flags, zero brackets except placeholder text, zero annotations]
<<<GRANT_BODY_END>>>

<<<QA_REPORT_BEGIN>>>
GRANT QUALITY SCORE: [X.X] / 10

SCORE BREAKDOWN:
D1 Funder Alignment (20%): [score]/10 — [one sentence explaining score]
D2 Narrative Strength (20%): [score]/10 — [one sentence]
D3 Evidence and Specificity (20%): [score]/10 — [one sentence]
D4 Logic Model Completeness (15%): [score]/10 — [one sentence]
D5 Budget Quality (15%): [score]/10 — [one sentence]
D6 Differentiation (10%): [score]/10 — [one sentence]
Weighted Final: [D1×0.20 + D2×0.20 + D3×0.20 + D4×0.15 + D5×0.15 + D6×0.10] = [X.X] / 10

REVISION CYCLES RUN: [number]
[If cycles > 0: For each cycle, list: "Cycle N: Rewrote [sections] to improve [dimension] from [old score] to [new score]"]

CONTEXT ASSESSMENT:
[List any minimum requirements that were missing and how they were addressed]

QA FLAGS:
[List every ⚠️ flag generated during writing. If none: ✓ No flags — grant passed all QA checks.]

WEB-SOURCED INFORMATION:
[List every 🌐 item requiring client confirmation. If none: ✓ No web-sourced content — all claims from intake form.]

FUNDER PRIORITY ALIGNMENT:
[List the top 3 priorities identified from guidelines using funder's exact language. For each: which grant section references it and the exact quote used.]

FUNDING CASE STRESS TEST:
[3-sentence max: the single strongest case for why this funder should fund this org over all others, using specific numbers and community context.]

AI DETECTION REVIEW:
[5 most generic sentences from the grant. For each — ORIGINAL: [sentence] / REVISED: [more specific rewrite]]

BUDGET MATH VERIFICATION:
[List every line item with amount as interpreted. Sum. Confirm total = ${amountFormatted}.]

BEFORE YOU SUBMIT CHECKLIST:
REQUIRED ATTACHMENTS:
☐ IRS 501(c)(3) determination letter
☐ Most recent Form 990
☐ Current board of directors list
☐ Most recent financial statements
☐ Any additional attachments specified by funder

[List every field requiring human completion before submission, with ✓ confirmed or ⚠️ PLACEHOLDER status]

DATA CONSISTENCY:
[List ONLY mismatches found. If all figures consistent: ✓ All figures consistent — no mismatches found.]

WORD COUNT NOTES:
[If word limits apply: list each section's count. If not: No word limits specified.]

[If CLIENT_INPUT_REQUIRED: include full CLIENT INPUT REQUIRED REPORT and DRAFT FOLLOW-UP EMAIL here]
<<<QA_REPORT_END>>>`;
}

// Parse Claude's output and save all fields to the database
async function saveGrantResult(submissionId, fullOutput) {
  const bodyMatch = fullOutput.match(/<<<GRANT_BODY_BEGIN>>>([\s\S]*?)<<<GRANT_BODY_END>>>/);
  const qaMatch   = fullOutput.match(/<<<QA_REPORT_BEGIN>>>([\s\S]*?)<<<QA_REPORT_END>>>/);

  const grantBody = bodyMatch ? bodyMatch[1].trim() : fullOutput;
  const qaReport  = qaMatch   ? qaMatch[1].trim()   : '';

  const scoreMatch   = qaReport.match(/GRANT QUALITY SCORE:\s*([\d.]+)\s*\/\s*10/);
  const qualityScore = scoreMatch ? parseFloat(scoreMatch[1]) : null;

  const clientInputRequired =
    qaReport.includes('CLIENT_INPUT_REQUIRED: true') ||
    qaReport.includes('GRANT CANNOT BE COMPLETED');

  const status = clientInputRequired ? 'input_required' : 'draft_ready';

  await updateSubmission(submissionId, {
    grant_draft:           fullOutput,
    grant_body:            grantBody,
    qa_report:             qaReport,
    quality_score:         qualityScore,
    client_input_required: clientInputRequired,
    grant_generated_at:    new Date().toISOString(),
    status,
  });

  console.log(`Grant saved for ${submissionId} | Score: ${qualityScore} | Status: ${status}`);
}

// Main function — called from the /webhook route after payment confirmed.
// Accepts a submission ID (string), fetches the full record from DB,
// and throws immediately if the record is not found.
async function generateGrant(submissionId) {
  const submission = await getSubmission(submissionId);
  if (!submission) {
    throw new Error(`Submission not found: ${submissionId}`);
  }

  console.log(`\nGenerating grant for: ${submission.org_name} (ID: ${submissionId})`);

  try {
    const guidelinesText = await fetchGuidelinesText(submission.guidelines_url);
    console.log(guidelinesText ? 'Guidelines fetched.' : 'No guidelines — proceeding without.');

    const prompt = buildPrompt(submission, guidelinesText);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    });

    const fullOutput = message.content[0].text;
    await saveGrantResult(submissionId, fullOutput);
    console.log(`Grant generation complete for submission ${submissionId}`);

  } catch (err) {
    console.error(`Grant generation failed for submission ${submissionId}:`, err.message);
    try {
      await updateSubmission(submissionId, {
        status: 'generation_failed',
        error:  err.message,
      });
    } catch (updateErr) {
      console.error('Failed to update error status:', updateErr.message);
    }
  }
}

module.exports = { generateGrant };
