// Local review proposal only. All organizations, rules, inputs and figures below are invented.
const answers = [
  {
    section: 'Need', title: '1. Describe the need.', limit: 150,
    paragraphs: [
      'In Harbor Path Learning’s planning survey, 28 of 40 responding caregivers requested after-school reading practice, and 20 identified transport as a barrier to attending activities. These responses describe the surveyed families; they do not establish reading proficiency or represent every family in the community.',
      'Harbor Path Learning proposes guided reading practice for 30 students in grades 2–4 at one community center. The 24-week program combines a regular place to practice with books and transport vouchers for participating families who need them. This addresses the Community Learning Fund’s priorities of after-school reading access and reducing participation barriers.'
    ],
    note: 'The survey figures come from the fictional intake. The response identifies who answered and limits what those responses support. It connects the proposed work to the fictional funder’s stated priorities without inventing district-wide statistics.'
  },
  {
    section: 'Project', title: '2. Explain the proposed project.', limit: 200,
    paragraphs: [
      'Harbor Path Learning requests $12,000 to provide 24 weekly, 90-minute after-school reading sessions for 30 students in grades 2–4 at one community center. Two facilitators will lead guided practice and small-group reading activities. Community-center outreach will invite eligible families to enroll; registration will close at 30 students.',
      'The request funds 160 combined facilitator hours for session delivery, preparation, enrollment coordination and assessment; 30 student reading kits and 20 shared books; and 100 transport vouchers worth $20 each. Vouchers will be allocated according to participating families’ stated transport needs, within that budget.',
      'Facilitators will record attendance at each session and administer the same program-developed, 10-item reading check in weeks 1 and 24. The team will report attendance, completion and paired reading-check results separately. It will record missing assessments rather than assume improvement for students without comparable results.'
    ],
    note: 'The activities, staffing, duration, assessment and budget all trace to the fictional intake. Transport support has a defined limit. Neither improved reading nor an unlimited transport benefit is promised.'
  },
  {
    section: 'Outcomes', title: '3. State the outcomes and measurement.', limit: 120,
    paragraphs: [
      'The enrollment goal is 30 students. The completion goal is at least 24 students attending 18 or more of the 24 sessions. Facilitators will maintain session attendance records.',
      'The learning goal is for at least 18 completers to improve by two or more correct answers on the program-developed, 10-item reading check between weeks 1 and 24. Results will include the number of paired assessments and missing assessments. This check describes performance on the program’s tasks; it is not a standardized reading-level measure or proof that the program caused any change. These are future goals, not achieved results.'
    ],
    note: 'Participation and learning have separate measures and targets. The proposed reading target is supplied in the fictional intake, not inferred from an attendance goal. The response states the limits of the assessment and avoids a causal claim.'
  },
  {
    section: 'Budget', title: '4. Explain the budget.', limit: 120,
    paragraphs: [
      'The $12,000 request covers the full proposed project budget: $8,000 for two facilitators working 80 hours each at $50 per hour; $2,000 for 30 student kits at $50 each and 20 shared books at $25 each; and $2,000 for 100 transport vouchers at $20 each.',
      'Each facilitator’s 80 hours includes 36 hours delivering the 24 sessions and 44 hours for preparation, enrollment coordination and assessment. No matching funds, other donor commitments or additional costs are assumed. These rates and quantities are the organization’s planning estimates, not supplier quotes.'
    ],
    note: 'The narrative reconciles with every line below. The facilitator hours include both delivery and other program work. Estimates are identified as estimates; no matching commitment or supplier quote is invented.'
  }
];
const answerHtml = answers.map(a => `<h2>${a.title}</h2><p class="small">Fictional prompt · Maximum ${a.limit} words</p><div class="sample-answer" data-sample-section="${a.section}" data-limit="${a.limit}"><div class="answer-text">${a.paragraphs.map(p => `<p>${p}</p>`).join('')}</div><p class="small" data-word-count></p><div class="annotation"><strong>Editorial note:</strong> ${a.note}</div></div>`).join('\n');

module.exports = {
  path: '/sample-grant-application',
  title: 'Sample Nonprofit Grant Application | Wellspring Grants',
  description: 'Inspect a completed fictional grant-writing example with source inputs, funder priorities, four answers, word limits, budget calculations and editorial notes.',
  heading: 'See the inputs.<br>Inspect the finished writing.',
  intro: 'Four completed fictional application responses, with the inputs and editorial notes that explain them.',
  article: true,
  body: `
<div class="note"><strong>Entirely fictional demonstration.</strong> Harbor Path Learning, Community Learning Fund, the survey, funder rules, program plan and every figure are invented. This is not a client application, real research, a funded grant, a customer testimonial or evidence of past service results.</div>
<p>This focused example shows four completed narrative responses after the example’s missing inputs have been clarified. It is not a complete real grant application. Actual prompts, limits, attachments and accepted service scope vary by funder.</p>
<div class="tool-actions"><a class="button secondary" href="/sample-grant-application.txt" download>Download sample (.txt)</a><button class="button secondary" type="button" data-print>Print the example</button></div>
<p><a href="#sample-responses">Read the completed answers</a> · <a href="#sample-source">Inspect the source inputs</a> · <a href="#sample-review">See the review checks</a></p>
<h2>The fictional funder brief</h2>
<p>For this demonstration only, Community Learning Fund supports after-school reading access for students in grades 2–4 and practical measures that reduce participation barriers. The invented opportunity permits up to $12,000 for facilitator time, reading materials and transport support, requires no match, and asks the four questions below. Its fictional rules allow disclosed technology-assisted drafting and outside editorial help. These rules do not describe any real funder.</p>
<h2 id="sample-source">The fictional intake supplied to the writer</h2>
<p>The following inputs are assumed to have been clarified within this invented scenario. They are not independently verified real-world facts.</p>
<div class="table-scroll"><table><caption>Invented source inputs used in the responses</caption><tbody>
<tr><th scope="row">Organization and project</th><td>Harbor Path Learning, fictional nonprofit; after-school reading at one community center.</td></tr>
<tr><th scope="row">Planning evidence</th><td>Fictional caregiver survey: 40 responses; 28 request reading practice; 20 report a transport barrier. These groups may overlap. No claim about community-wide prevalence or reading proficiency is supplied.</td></tr>
<tr><th scope="row">Participants and recruitment</th><td>Enrollment goal: 30 students in grades 2–4. Recruit through community-center outreach and close registration at 30 students.</td></tr>
<tr><th scope="row">Activities and staffing</th><td>24 weekly sessions of 90 minutes. Two facilitators, each allocated 80 hours: 36 session-delivery hours plus 44 hours for preparation, enrollment coordination and assessment.</td></tr>
<tr><th scope="row">Participation goal</th><td>At least 24 students attend 18 or more sessions. Record attendance at each session.</td></tr>
<tr><th scope="row">Learning goal and measure</th><td>At least 18 completers improve by two correct answers on the same program-developed 10-item reading check in weeks 1 and 24. Report paired and missing assessments. This is not a standardized reading-level instrument.</td></tr>
<tr><th scope="row">Costs and request</th><td>$12,000 total project cost and request. Organization-supplied planning estimates: 160 facilitator hours at $50; 30 kits at $50; 20 books at $25; 100 transport vouchers at $20. Allocate vouchers by family need within the available quantity. No match or other donor commitment.</td></tr>
</tbody></table></div>
<h2 id="sample-responses">The completed fictional responses</h2>
<p>These are the proposed narrative answers for the invented brief. The notes explain the editorial choices; they are not part of the word-limited answers.</p>
${answerHtml}
<div class="table-scroll"><table><caption>Fictional planning budget — not a real request or supplier quote</caption><thead><tr><th scope="col">Use</th><th scope="col">Calculation</th><th scope="col">Amount</th></tr></thead><tbody>
<tr><td>Facilitators</td><td>2 × 80 hours × $50</td><td>$8,000</td></tr>
<tr><td>Student reading kits</td><td>30 × $50</td><td>$1,500</td></tr>
<tr><td>Shared books</td><td>20 × $25</td><td>$500</td></tr>
<tr><td>Transport vouchers</td><td>100 × $20</td><td>$2,000</td></tr>
<tr><th scope="row">Total project cost and request</th><td>$8,000 + $1,500 + $500 + $2,000</td><td><strong>$12,000</strong></td></tr>
</tbody></table></div>
<h2 id="sample-review">What the editorial review checks in this example</h2>
<ul><li>Funder alignment: the answers address the invented reading-access and participation priorities.</li><li>Evidence: survey counts trace to the fictional intake and are not generalized to the whole community.</li><li>Program logic: activities, participation targets and reading-check targets are distinct and consistent.</li><li>Budget: quantities, rates, facilitator hours and request amount reconcile.</li><li>Prompt limits: the displayed word counts cover the answers, excluding editorial notes.</li><li>Claim limits: plans are not presented as results, and a program-defined assessment is not presented as standardized evidence or proof of causation.</li></ul>
<h2>How missing information is handled</h2>
<details><summary>Before clarification: an example of a review hold</summary><p>An initial brief that only says “30 students, 24 sessions, $12,000” does not support a complete need statement, a learning target or cost calculations. The writer should ask for the evidence of need, staffing and schedule, assessment method and target, and cost basis. The clarified fictional inputs above supply those details for this demonstration. They must never be invented for a real customer to make a draft look finished.</p></details>
<h2>What a real customer still reviews and submits</h2>
<p>The $450 service is writing support for one accepted foundation, community foundation or corporate application, with AI-assisted drafting, human review and editable Google Doc or Word delivery. This public demonstration is provided as a text download; it is not a customer delivery document or an outcome guarantee.</p>
<p>Your organization confirms real funder eligibility and technology rules, supplies substantiated facts and financial information, checks the delivered writing, secures internal approval, prepares the required forms and attachments, and submits to the funder. This example does not include opportunity research, financial statements, a technical budget workbook, portal submission or post-award reporting.</p>
<p><a href="/quality-and-ai">Read how drafting and human review work</a> · <a href="/pricing">Review the $450 scope, delivery and revision terms</a> · <a href="/fit">Check your application’s fit</a></p>
`
};
