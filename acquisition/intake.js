const {text,email,url,date} = require('./validation');
const required = ['org_name','mission','ein','signer_name','signer_title','org_phone','org_street','org_city','org_state','org_zip','org_location','tax_exempt','years_operating','track_record','funder_name','grant_program','guidelines_url','grant_deadline','problem_statement','project_description','target_population','expected_outcomes','sustainability_plan','budget_breakdown','amount_requested','annual_budget','delivery_format','contact_name','contact_email'];
const optional=['key_staff_credentials','special_requirements','referral_source','anything_else','promo_code'];
function validate(body) {
  if(body.non_federal_confirmed!=='yes')throw new Error('Confirm this is a non-federal grant and review funder eligibility before paying.');
  const result={};
  for(const key of [...required,...optional]) {
    if(body[key]===undefined && optional.includes(key)) continue;
    result[key]=text(body[key],key==='promo_code'?50:12000);
    if(required.includes(key) && !result[key]) throw new Error('Please complete all required intake fields.');
  }
  result.contact_email=email(result.contact_email);
  result.guidelines_url=url(result.guidelines_url);
  if(/(^|\.)grants\.gov$/.test(new URL(result.guidelines_url).hostname))throw new Error('Federal applications are not supported.');
  result.grant_deadline=date(result.grant_deadline);
  if(new Date(result.grant_deadline).getTime()<Date.now()+48*3600000)throw new Error('Please check grant fit before paying for a deadline less than 48 hours away.');
  for(const key of ['amount_requested','annual_budget','years_operating']) {
    const value=Number(result[key]);
    if(!Number.isFinite(value)||value<0||(key!=='years_operating'&&value===0)||(key==='years_operating'&&!Number.isInteger(value)))throw new Error('Check your budget and years in operation.');
    result[key]=value;
  }
  if(!['google_doc','word'].includes(result.delivery_format))throw new Error('Select a delivery format.');
  if(!['yes','no','pending'].includes(result.tax_exempt))throw new Error('Select your nonprofit status.');
  if(!/^\d{2}-?\d{7}$/.test(result.ein))throw new Error('Check your EIN.');
  return result; // Ignore untrusted id/status/paid_at/is_comp and column names.
}
module.exports={validate};
