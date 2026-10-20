const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildPrompt,saveGrantResult}=require('../generateGrant');
const output=(body='We request $1,000 for the supplied project.',qa='GRANT QUALITY SCORE: 9.2 / 10\nCLIENT_INPUT_REQUIRED: false\nNo flags.')=>`<<<GRANT_BODY_BEGIN>>>\n${body}\n<<<GRANT_BODY_END>>>\n<<<QA_REPORT_BEGIN>>>\n${qa}\n<<<QA_REPORT_END>>>`;
async function save(text,evidence){let saved;await saveGrantResult('synthetic-order',text,async(id,data)=>{assert.equal(id,'synthetic-order');saved=data;},evidence);return saved;}
test('missing guidelines cannot become ready despite a high model score',async()=>{
 const draft=await save(output(),{guidelinesVerified:false});
 assert.equal(draft.status,'input_required');assert.equal(draft.client_input_required,true);
});
test('model score cannot clear unresolved facts or unfinished required fields',async()=>{
 for(const qa of ['CLIENT_INPUT_REQUIRED : TRUE','⚠️ CLIENT INPUT REQUIRED: confirm project scope','⚠️ UNVERIFIABLE — local statistic','CONFIRM WITH CLIENT BEFORE SUBMISSION','REQUEST OUTSIDE FUNDER\'S STATED AWARD RANGE']){
  assert.equal((await save(output('Supplied project.',`GRANT QUALITY SCORE: 9.9 / 10\n${qa}`))).status,'input_required');
 }
 assert.equal((await save(output('Authorized signer: [ENTER NAME]'))).status,'input_required');
});
test('malformed or truncated responses cannot save QA as a grant body',async()=>{
 for(const text of ['plain unstructured response',output().replace('<<<QA_REPORT_END>>>',''),output().replace('<<<GRANT_BODY_END>>>',''),output()+'\n<<<GRANT_BODY_BEGIN>>>',output('','QA'),output('Body',''),output().replace('<<<GRANT_BODY_END>>>\n<<<QA_REPORT_BEGIN>>>','<<<QA_REPORT_BEGIN>>>\n<<<GRANT_BODY_END>>>')]){
  let writes=0;await assert.rejects(saveGrantResult('synthetic-order',text,async()=>writes++));assert.equal(writes,0);
 }
});
test('a complete structured draft preserves the body and QA separately for human review',async()=>{
 const saved=await save(output(),{guidelinesVerified:true});
 assert.equal(saved.status,'draft_ready');assert.equal(saved.quality_score,9.2);assert.equal(saved.client_input_required,false);
 assert.equal(saved.grant_body,'We request $1,000 for the supplied project.');assert.ok(!saved.grant_body.includes('QUALITY SCORE'));assert.ok(saved.qa_report.includes('QUALITY SCORE'));
});
test('prompt requires actual evidence and funder questions ahead of default prose',()=>{
 const prompt=buildPrompt({amount_requested:1000,funder_name:'Synthetic Foundation',grant_program:'Synthetic Program',org_name:'Synthetic Test Org'},null);
 assert.ok(prompt.includes('Set CLIENT_INPUT_REQUIRED: true and ask for the current official guidelines'));
 assert.ok(prompt.includes('Follow the funder\'s actual questions, order, required headings and word/character limits ahead of the default structure'));
 assert.ok(prompt.includes('Never change costs, invent a balancing item'));
 assert.ok(prompt.includes('Model memory is not a verified source'));
 assert.ok(!prompt.includes('write a reasonable estimate'));assert.ok(!prompt.includes('attempt to fill the gap'));
});
