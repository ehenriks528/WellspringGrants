const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const express=require('express');
const {PGlite}=require('@electric-sql/pglite');
const {register}=require('../acquisition/routes');
const {readLead}=require('../acquisition/validation');
let db,pool,server,base,ackCalls=0;
const origin='https://wellspringgrants.com';
process.env.APP_URL=origin;process.env.ADMIN_PASSWORD='isolated-native-form-test-only';
before(async()=>{
 db=new PGlite();for(const file of ['db/schema.sql','acquisition/schema.sql'])await db.exec(fs.readFileSync(file,'utf8'));
 const query=async(sql,values)=>{const r=await db.query(sql,values);return {...r,rowCount:r.affectedRows??r.rows.length};};
 pool={query,connect:async()=>({query,release(){}})};
 const app=express();app.use(express.urlencoded({extended:true,limit:'1mb'}));app.use(express.json({limit:'1mb'}));
 register(app,pool,async()=>{ackCalls++;});
 app.use((error,req,res,next)=>res.status(500).json({error:'Isolated test failure'}));
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
const inquiry={org_name:'Synthetic native nonprofit',contact_name:'Synthetic Contact',email:'native-fixture@example.org',location:'Local fixture city',project:'Private synthetic project answers must not appear in the URL or result.',consent:'on'};
const native=(body,requestOrigin=origin)=>fetch(base+'/api/fit',{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/x-www-form-urlencoded',Accept:'text/html'},body:new URLSearchParams(body)});
test('native fit form posts to the existing endpoint, saves before acknowledgment and returns a private readable result',async()=>{
 const markup=fs.readFileSync('public/fit.html','utf8');
 assert.match(markup,/<form\b[^>]*id="fit"[^>]*method="post"[^>]*action="\/api\/fit"/);
 assert.match(markup,/<meta name="referrer" content="origin">/);
 const response=await native(inquiry);assert.equal(response.status,201);assert.equal(response.url,base+'/api/fit');
 assert.match(response.headers.get('content-type'),/text\/html/);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
 const html=await response.text();assert.match(html,/<h1>Inquiry saved\.<\/h1>/);assert.match(html,/No payment was taken/);assert.ok(!html.includes(inquiry.email));assert.ok(!html.includes(inquiry.project));assert.ok(!html.includes('<script'));
 const row=(await pool.query('SELECT * FROM acquisition_leads')).rows[0];assert.equal(row.email,inquiry.email);assert.equal(row.source,'unattributed');assert.ok(row.consent_at);assert.equal(ackCalls,1);
 const cookie=response.headers.get('set-cookie').split(';')[0];assert.equal(readLead({headers:{cookie}},process.env.ADMIN_PASSWORD),row.id);
 assert.equal((await pool.query("SELECT count(*)::int n FROM acquisition_events WHERE event='inquiry'")).rows[0].n,1);
});
test('native missing consent and honeypot failures explain that nothing was saved without reflecting answers',async()=>{
 for(const payload of [{...inquiry,consent:''},{...inquiry,company_fax:'trap'}]){
  const response=await native(payload);assert.equal(response.status,400);const html=await response.text();assert.match(html,/<h1>Inquiry not saved\.<\/h1>/);assert.match(html,/Back button/);assert.ok(!html.includes(inquiry.email));assert.ok(!html.includes(inquiry.project));
 }
 assert.equal((await pool.query('SELECT count(*)::int n FROM acquisition_leads')).rows[0].n,1);assert.equal(ackCalls,1);
});
test('native cross-site posts cannot save or acknowledge an inquiry',async()=>{
 const response=await native(inquiry,'https://attacker.example');assert.equal(response.status,403);assert.equal(ackCalls,1);assert.equal((await pool.query('SELECT count(*)::int n FROM acquisition_leads')).rows[0].n,1);
});
test('scripted JSON fit submissions retain their response and coarse source policy',async()=>{
 const response=await fetch(base+'/api/fit',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({...inquiry,email:'json-fixture@example.org',consent:true,source:'partner/resources'})});
 assert.equal(response.status,201);assert.match(response.headers.get('content-type'),/application\/json/);assert.deepEqual(await response.json(),{saved:true,message:'Your inquiry is saved. We’ll review your grant fit and reply by email.'});
 assert.equal((await pool.query('SELECT source FROM acquisition_leads WHERE email=$1',['json-fixture@example.org'])).rows[0].source,'referral/resources');assert.equal(ackCalls,2);
});
