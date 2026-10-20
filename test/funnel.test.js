const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const express=require('express');
const basicAuth=require('express-basic-auth');
const {PGlite}=require('@electric-sql/pglite');
const {claimPayment}=require('../acquisition/payments');
const {register,sameOrigin,recordCheckout}=require('../acquisition/routes');
const {signLead,readLead}=require('../acquisition/validation');
const {acknowledge}=require('../acquisition/email');
const {publicIP,fetchGuidelinesText}=require('../acquisition/safe-fetch');
let db,pool,server,base,ackCalls=0;
const origin='https://wellspringgrants.com';
const auth='Basic '+Buffer.from('admin:only-for-isolated-tests').toString('base64');
process.env.ADMIN_PASSWORD='only-for-isolated-tests';process.env.APP_URL=origin;
before(async()=>{
 db=new PGlite();await db.exec(fs.readFileSync('db/schema.sql','utf8'));await db.exec(fs.readFileSync('acquisition/schema.sql','utf8'));await db.exec(fs.readFileSync('acquisition/schema.sql','utf8'));
 await db.exec(fs.readFileSync('acquisition/fulfillment.sql','utf8'));
 let tail=Promise.resolve();
 const query=async(sql,values)=>{const r=await db.query(sql,values);return {...r,rowCount:r.affectedRows??r.rows.length};};
 pool={query,connect:async()=>{let release;const previous=tail;tail=new Promise(resolve=>release=resolve);await previous;return {query,release};}};
 const app=express();app.use(express.json());app.use('/admin',basicAuth({users:{admin:process.env.ADMIN_PASSWORD}}));
 register(app,pool,async()=>{ackCalls++;});app.use((error,req,res,next)=>res.status(500).json({error:'test failure'}));
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
const inquiry={org_name:'Test nonprofit',contact_name:'Test Contact',email:'contact@example.org',location:'Boston, MA',project:'An afterschool program needing a foundation grant application.',consent:true};
const post=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('consent and valid inquiry required; forbidden origin cannot save or acknowledge',async()=>{
 assert.equal((await post('/api/fit',{...inquiry,consent:false})).status,400);
 assert.equal((await post('/api/fit',inquiry,{Origin:'https://attacker.example'})).status,403);
 assert.equal(ackCalls,0);assert.equal((await pool.query('SELECT * FROM acquisition_leads')).rows.length,0);
});
test('inquiry, consent, follow-up and event persist before acknowledgment; signed cookie links checkout',async()=>{
 const response=await post('/api/fit',{...inquiry,source:'approved_outreach/first_customer'});assert.equal(response.status,201);assert.equal(ackCalls,1);
 const rows=(await pool.query('SELECT * FROM acquisition_leads')).rows;assert.equal(rows.length,1);assert.ok(rows[0].consent_at);assert.ok(rows[0].follow_up_at);assert.equal(rows[0].source,'email/first_customer');
 const cookie=response.headers.get('set-cookie').split(';')[0];const req={headers:{cookie}};
 assert.equal(readLead(req,process.env.ADMIN_PASSWORD),rows[0].id);
 await recordCheckout(pool,req,'paid-test','cs_test');
 assert.equal((await pool.query("SELECT lead_id FROM acquisition_events WHERE event='checkout_created'")).rows[0].lead_id,rows[0].id);
 assert.equal(readLead({headers:{cookie:cookie+'x'}},process.env.ADMIN_PASSWORD),null);
});
test('admin PII cannot be fetched anonymously and state mutations reject cross-site requests',async()=>{
 assert.equal((await fetch(base+'/admin/api/leads')).status,401);
 assert.equal((await post('/admin/api/suppress',{email:'contact@example.org'},{Authorization:auth,Origin:'https://attacker.example'})).status,403);
});
test('a paid webhook must match amount, currency, payment status, saved session and non-comp submission; retries do not double count',async()=>{
 await pool.query("INSERT INTO submissions(id,status,stripe_session_id) VALUES('paid-test','pending_payment','cs_test')");
 const session={id:'cs_test',mode:'payment',payment_status:'paid',amount_total:45000,currency:'usd',livemode:false,metadata:{submissionId:'paid-test'}};
 for(const invalid of [{payment_status:'unpaid'},{currency:'eur'},{amount_total:1},{mode:'subscription'},{metadata:{}}])assert.equal(await claimPayment(pool,{...session,...invalid}),null);
 assert.equal(await claimPayment(pool,{...session,id:'cs_wrong'}),null);
 assert.ok(await claimPayment(pool,session));assert.equal(await claimPayment(pool,session),null);
 const events=(await pool.query("SELECT * FROM acquisition_events WHERE event='purchase'")).rows;assert.equal(events.length,1);assert.equal((await pool.query("SELECT l.source FROM acquisition_events e JOIN acquisition_leads l ON l.id=e.lead_id WHERE e.event='purchase' AND e.external_id='cs_test'")).rows[0].source,'email/first_customer');assert.equal(events[0].live,false);assert.equal(events[0].amount_cents,45000);
 const metrics=await (await fetch(base+'/admin/api/leads',{headers:{Authorization:auth}})).json();assert.equal(metrics.metrics.paid_customers,0);assert.equal(metrics.metrics.revenue_cents,0);
 await pool.query("INSERT INTO submissions(id,status,stripe_session_id,is_comp) VALUES('comp-test','pending_payment','cs_comp',true)");
 assert.equal(await claimPayment(pool,{...session,id:'cs_comp',metadata:{submissionId:'comp-test'}}),null);
});
test('live paid conversions count once, including concurrent webhook delivery',async()=>{
 await pool.query("INSERT INTO submissions(id,status,stripe_session_id) VALUES('live-test','pending_payment','cs_live')");
 const session={id:'cs_live',mode:'payment',payment_status:'paid',amount_total:45000,currency:'usd',livemode:true,metadata:{submissionId:'live-test'}};
 const results=await Promise.all([claimPayment(pool,session),claimPayment(pool,session)]);assert.equal(results.filter(Boolean).length,1);
 const metrics=await (await fetch(base+'/admin/api/leads',{headers:{Authorization:auth}})).json();assert.equal(metrics.metrics.paid_customers,1);assert.equal(metrics.metrics.revenue_cents,45000);
});
test('ack provider error stays failed and can be retried with a stable idempotency key',async()=>{
 const lead=(await pool.query('SELECT * FROM acquisition_leads LIMIT 1')).rows[0];
 await assert.rejects(acknowledge(pool,lead.id,{emails:{send:async()=>({error:{message:'rejected'}})}}));
 assert.equal((await pool.query('SELECT acknowledgement_status FROM acquisition_leads WHERE id=$1',[lead.id])).rows[0].acknowledgement_status,'failed');
 let options;await acknowledge(pool,lead.id,{emails:{send:async(message,opts)=>{options=opts;assert.equal(message.to,lead.email);return {data:{id:'email_test'}};}}});
 assert.equal(options.idempotencyKey,'fit-ack/'+lead.id);assert.equal((await pool.query('SELECT acknowledgement_status FROM acquisition_leads WHERE id=$1',[lead.id])).rows[0].acknowledgement_status,'accepted');
});
test('outreach needs human approval, postal address and opt-out; suppression blocks approved drafts too',async()=>{
 const payload={org_name:'Test prospect',email:'prospect@example.org',contact_source:'https://example.org/contact',demand_source:'https://example.org/writer',funder_source:'https://example.org/grants',eligibility_evidence:'Verified test evidence',deadline:'2099-11-10',subject:'Writing support',body:'A commercial service message. Reply STOP to stop contact. 123 Test Postal Address'};
 const created=await post('/admin/api/outreach',payload,{Authorization:auth});assert.equal(created.status,201);const {id}=await created.json();
 assert.equal((await post('/admin/api/outreach/'+id+'/mark-sent',{}, {Authorization:auth})).status,409);
 assert.equal((await post('/admin/api/outreach/'+id+'/approve',{}, {Authorization:auth})).status,409);
 process.env.OUTREACH_POSTAL_ADDRESS='123 Test Postal Address';
 assert.equal((await post('/admin/api/outreach/'+id+'/approve',{}, {Authorization:auth})).status,200);
 assert.equal((await pool.query('SELECT * FROM acquisition_audit WHERE record_id=$1',[id])).rows.length,1);
 assert.equal((await post('/admin/api/suppress',{email:payload.email},{Authorization:auth})).status,200);
 assert.equal((await post('/admin/api/outreach/'+id+'/mark-sent',{confirmation:'I sent this approved message manually'},{Authorization:auth})).status,409);
 assert.equal((await pool.query('SELECT status FROM acquisition_outreach WHERE id=$1',[id])).rows[0].status,'suppressed');
});
test('private and metadata guideline destinations are blocked without making HTTP requests',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1'])assert.equal(publicIP(ip),false,ip);
 assert.equal(publicIP('8.8.8.8'),true);
 for(const target of ['http://example.org','https://127.0.0.1/secret','https://169.254.169.254/latest/meta-data','https://[::1]'])assert.equal(await fetchGuidelinesText(target),null);
});
test('legacy in-flight checkout can be claimed only when its customer email matches the saved intake',async()=>{
 await pool.query("INSERT INTO submissions(id,status,contact_email) VALUES('legacy-test','pending_payment','legacy@example.org')");
 const session={id:'cs_legacy',mode:'payment',payment_status:'paid',amount_total:45000,currency:'usd',livemode:false,metadata:{submissionId:'legacy-test'}};
 assert.equal(await claimPayment(pool,{...session,customer_email:'wrong@example.org'}),null);
 assert.ok(await claimPayment(pool,{...session,customer_email:'legacy@example.org'}));
});

test('the inquiry endpoint independently normalizes coarse labels and respects privacy headers',async()=>{
 const cases=[
  {source:'private@example.org',headers:{},expected:'unattributed'},
  {source:'email/resources',headers:{DNT:'1'},expected:'unattributed'},
  {source:'email/resources',headers:{'Sec-GPC':'1'},expected:'unattributed'},
  {source:'google/resources',headers:{},expected:'search/resources'},
  {source:undefined,headers:{},expected:'unattributed'},
 ];
 for(const [index,item] of cases.entries()){
  const email='source-check-'+index+'@example.org';const response=await post('/api/fit',{...inquiry,email,source:item.source},item.headers);assert.equal(response.status,201);
  const saved=(await pool.query('SELECT source FROM acquisition_leads WHERE email=$1',[email])).rows[0];assert.equal(saved.source,item.expected);
 }
});
