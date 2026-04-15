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
  const funderContext = guidelinesText
    ? `Here is text pulled from the funder's grant guidelines page:\n\n"${guidelinesText}"\n\nUse this to align the application's language and emphasis with the funder's stated priorities.`
    : `No guidelines text was available. Use your knowledge of ${submission.funder_name} and the grant program "${submission.grant_program}" to align the application appropriately.`;

  const specialReqs = submission.special_requirements
    ? `The funder has the following special requirements — follow them precisely:\n${submission.special_requirements}`
    : 'No special formatting requirements were provided. Use standard grant writing structure.';

  return `You are an expert grant writer with 20 years of experience helping small nonprofits secure community foundation funding. Your writing is clear, compelling, evidence-based, and donor-focused — never vague or generic.

Write a complete, ready-to-submit grant application using the information below. Every section should feel tailored to this specific funder, not copy-pasted from a template.

---

FUNDER INFORMATION
Funder: ${submission.funder_name}
Grant Program: ${submission.grant_program}
Amount Requested: $${Number(submission.amount_requested).toLocaleString()}
Application Deadline: ${submission.grant_deadline}

${funderContext}

---

ORGANIZATION INFORMATION
Organization: ${submission.org_name}
Location: ${submission.org_location}
501(c)(3) Status: ${submission.tax_exempt}
Mission: ${submission.mission}
${submission.annual_budget ? `Annual Operating Budget: $${Number(submission.annual_budget).toLocaleString()}` : ''}

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

Write the following sections in order. Use the section headers exactly as written. Write in first person plural ("we", "our organization"). Be specific — use the numbers and details provided. Do not invent facts not provided above.

## Executive Summary
(150–200 words. Summarize the organization, the problem, the project, and the ask.)

## Organizational Background
(200–300 words. Establish credibility — mission, community role, capacity to deliver.)

## Statement of Need
(250–400 words. Make the case for why this problem matters and why it's urgent. Use the data and examples provided.)

## Project Description
(350–500 words. Explain exactly what you will do, how, and on what timeline.)

## Goals and Objectives
(Use a clear list format. 2–3 goals, each with 1–2 measurable objectives.)

## Evaluation Plan
(150–250 words. How will you measure success? Who will track it and how often?)

## Budget Narrative
(Explain each line item from the budget breakdown. Connect costs to activities.)

## Sustainability Plan
(150–200 words. How will this work continue after the grant period ends?)`;
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
      max_tokens: 4000,
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
