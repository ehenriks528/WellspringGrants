const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {createCheckoutHandler}=require('../acquisition/checkout');
const {sameOrigin}=require('../acquisition/routes');
const origin='https://wellspringgrants.com';
process.env.APP_URL=origin;process.env.ADMIN_PASSWORD='isolated-checkout-test-password';
let server,base,mode='normal',submissions=[],updates=[],queries=[],sessions=[];
const intake={purchase_terms_confirmed:'yes',non_federal_confirmed:'yes',org_name:'Synthetic nonprofit',mission:'Local test only',ein:'12-3456789',signer_name:'Test Director',signer_title:'Director',org_phone:'2025550100',org_street:'Test address',org_city:'Test City',org_state:'MA',org_zip:'02110',tax_exempt:'yes',years_operating:'0',track_record:'New organization with no completed programs',funder_name:'Fictional test funder',grant_program:'Synthetic application',guidelines_url:'https://example.org/grants',grant_deadline:'2099-01-01',special_requirements:'Synthetic project prompt, maximum 200 words.',problem_statement:'Synthetic context',project_description:'Synthetic program',target_population:'Synthetic participants',expected_outcomes:'Planned outcomes',sustainability_plan:'Proposed future fundraising',budget_breakdown:'Test budget',amount_requested:'12000',annual_budget:'100000',delivery_format:'word',contact_name:'Test Director',contact_email:'local-test@example.org'};
before(async()=>{
  const app=express();app.use(express.json());app.use(express.urlencoded({extended:false}));
  require('../acquisition/availability').register(app);
  app.post('/checkout',sameOrigin,createCheckoutHandler({
    pool:{query:async(sql,args)=>{queries.push({sql,args});if(mode==='unexpected')throw new Error('synthetic db error');return {rows:[{count:'0'}],rowCount:1};}},
    createSubmission:async submission=>submissions.push(submission),
    updateSubmission:async(id,values)=>updates.push({id,values}),
    claimPromo:async(pool,id)=>{if(mode!=='comp')return null;updates.push({id,values:{is_comp:true}});return {id,is_comp:true};},
    stripe:{checkout:{sessions:{create:async options=>{if(mode==='provider_failure')throw new Error('Synthetic provider rejection');sessions.push(options);return {id:'cs_test_synthetic',url:'https://checkout.stripe.com/c/pay/cs_test_synthetic'};}}}},
    generateGrant:async()=>{},sendConfirmationEmail:async()=>{},sendAdminNotificationEmail:async()=>{},
  }));
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port;
});
after(async()=>new Promise(resolve=>server.close(resolve)));
function post(body,accept='application/json',from=origin){
  return fetch(base+'/checkout',{method:'POST',redirect:'manual',headers:{Origin:from,Accept:accept,'Content-Type':'application/json'},body:JSON.stringify(body)});
}
test('checkout rejects unacknowledged policies and cross-origin requests before storing an order',async()=>{
  assert.equal((await post({...intake,purchase_terms_confirmed:'no'})).status,400);
  assert.equal((await post(intake,'application/json','https://attacker.example')).status,403);
  assert.equal(submissions.length,0);assert.equal(sessions.length,0);
});
test('enhanced checkout uses server price, persists policy acknowledgment, and returns a verified provider destination',async()=>{
  const response=await post({...intake,id:'forged',status:'paid',is_comp:true,amount_cents:1,financial_period:'FY 2026 synthetic budget',deadline_time:'17:00',deadline_timezone:'America/Los_Angeles'});
  assert.equal(response.status,200);assert.equal((await response.json()).redirect,'https://checkout.stripe.com/c/pay/cs_test_synthetic');
  assert.equal(sessions[0].line_items[0].price_data.unit_amount,45000);assert.equal(sessions[0].line_items[0].price_data.currency,'usd');
  const order=submissions[0];assert.equal(order.status,'pending_payment');assert.notEqual(order.id,'forged');assert.equal(order.is_comp,undefined);
  assert.equal(order.org_location,'Test City, MA');assert.match(order.special_requirements,/America\/Los_Angeles/);assert.match(order.special_requirements,/FY 2026/);
  assert.ok(queries.some(q=>q.sql.includes('purchase_scope_acknowledgments')));
});
test('plain form checkout redirects; provider failure and unexpected backend failure return recoverable JSON',async()=>{
  assert.equal((await post(intake,'text/html')).status,303);
  mode='provider_failure';let response=await post(intake);assert.equal(response.status,500);assert.match((await response.json()).error,/Payment setup failed/);
  mode='unexpected';response=await post(intake);assert.equal(response.status,500);assert.equal((await response.json()).redirect,undefined);
  mode='normal';
});
test('a supported complimentary order follows its existing flow without a paid checkout or revenue claim',async()=>{
  mode='comp';const before=sessions.length;
  const response=await post({...intake,promo_code:'SYNTHETIC'});
  assert.equal(response.status,200);assert.equal((await response.json()).redirect,'/confirmation.html');
  assert.equal(sessions.length,before);assert.ok(updates.some(update=>update.values.is_comp===true));mode='normal';
});
test('production readiness blocks test payments and comp work before any order or provider activity',async()=>{
  const names=['NODE_ENV','PAID_ORDERS_ENABLED','STRIPE_SECRET_KEY'];
  const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  const counts=[submissions.length,queries.length,sessions.length,updates.length];
  try{
    process.env.NODE_ENV='production';process.env.STRIPE_SECRET_KEY='sk_test_synthetic';delete process.env.PAID_ORDERS_ENABLED;
    let response=await fetch(base+'/api/order-availability');
    assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{acceptingOrders:false});
    process.env.PAID_ORDERS_ENABLED='true';
    response=await post({...intake,promo_code:'SYNTHETIC'});assert.equal(response.status,503);assert.match((await response.json()).error,/No order or payment/);
    process.env.STRIPE_SECRET_KEY='sk_live_synthetic';process.env.PAID_ORDERS_ENABLED='false';
    response=await post(intake,'text/html');assert.equal(response.status,503);
    assert.deepEqual([submissions.length,queries.length,sessions.length,updates.length],counts);
    process.env.PAID_ORDERS_ENABLED='true';
    assert.deepEqual(await (await fetch(base+'/api/order-availability')).json(),{acceptingOrders:true});
    response=await post(intake);assert.equal(response.status,200);
  }finally{for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}}
});
