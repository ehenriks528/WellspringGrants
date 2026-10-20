const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const express=require('express');
const basicAuth=require('express-basic-auth');
const jobs=require('../acquisition/fulfillment');
const {claimPromo}=require('../acquisition/promos');
const {claimPayment}=require('../acquisition/payments');
let pool,db,root,schema,server,base;
const origin='https://wellspringgrants.com';process.env.APP_URL=origin;
const auth='Basic '+Buffer.from('admin:queue-isolated-password').toString('base64');
before(async()=>{
 if(process.env.TEST_DATABASE_URL){
  const {Pool}=require('pg');root=new Pool({connectionString:process.env.TEST_DATABASE_URL});
  schema='ws_test_'+randomUUID().replaceAll('-','');await root.query('CREATE SCHEMA '+schema);
  pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path='+schema});
 }else{
  const {PGlite}=require('@electric-sql/pglite');db=new PGlite();let tail=Promise.resolve();
  const query=async(sql,values)=>{const r=await db.query(sql,values);return {...r,rowCount:r.affectedRows??r.rows.length};};
  pool={query,connect:async()=>{let release;const previous=tail;tail=new Promise(resolve=>release=resolve);await previous;return {query,release};}};
 }
 for(const file of ['db/schema.sql','acquisition/schema.sql','acquisition/fulfillment.sql'])await (db?db.exec(fs.readFileSync(file,'utf8')):pool.query(fs.readFileSync(file,'utf8')));
 // Idempotent migration against already-created tables.
 await (db?db.exec(fs.readFileSync('acquisition/fulfillment.sql','utf8')):pool.query(fs.readFileSync('acquisition/fulfillment.sql','utf8')));
 const app=express();app.use(express.json());app.use('/admin',basicAuth({users:{admin:'queue-isolated-password'}}));jobs.register(app,pool);
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{
 if(server)await new Promise(r=>server.close(r));
 if(db)await db.close();
 if(root){await pool.end();await root.query('DROP SCHEMA '+schema+' CASCADE');await root.end();}
});
async function pending(email='synthetic@example.org'){
 const id=randomUUID();await pool.query("INSERT INTO submissions(id,status,contact_email) VALUES($1,'pending_payment',$2)",[id,email]);return id;
}
async function accepted(){const id=await pending();await pool.query("UPDATE submissions SET status='generating',paid_at=now() WHERE id=$1",[id]);await jobs.enqueue(pool,id);return id;}
async function only(kind){await pool.query("UPDATE fulfillment_jobs SET state='succeeded' WHERE state IN ('queued','running') AND kind=$1",[kind]);}
const row=async id=>(await pool.query('SELECT * FROM submissions WHERE id=$1',[id])).rows[0];
test('payment and jobs commit together; a failed queue insert rolls back payment and revenue',async()=>{
 const id=await pending();await pool.query('UPDATE submissions SET stripe_session_id=$2 WHERE id=$1',[id,'cs_'+id]);
 const session={id:'cs_'+id,mode:'payment',payment_status:'paid',amount_total:45000,currency:'usd',livemode:false,metadata:{submissionId:id}};
 assert.equal(await claimPayment(pool,session,{expectedLive:true}),null);
 assert.equal(await claimPayment(pool,{...session,livemode:true},{expectedLive:false}),null);
 assert.equal((await row(id)).status,'pending_payment');
 const failing={connect:async()=>{const client=await pool.connect();return {query:(sql,args)=>{if(sql.includes('INSERT INTO fulfillment_jobs'))throw new Error('Synthetic queue outage');return client.query(sql,args);},release:()=>client.release()};}};
 await assert.rejects(claimPayment(failing,session));assert.equal((await row(id)).status,'pending_payment');
 assert.equal((await pool.query('SELECT count(*)::int n FROM acquisition_events WHERE submission_id=$1',[id])).rows[0].n,0);
 const results=await Promise.all([claimPayment(pool,session),claimPayment(pool,session)]);assert.equal(results.filter(Boolean).length,1);
 assert.equal((await pool.query('SELECT count(*)::int n FROM fulfillment_jobs WHERE submission_id=$1',[id])).rows[0].n,3);
 assert.equal((await pool.query("SELECT count(*)::int n FROM acquisition_events WHERE submission_id=$1 AND event='purchase'",[id])).rows[0].n,1);
});
test('concurrent promo requests cannot take the last use twice or reuse an email across codes',async()=>{
 await pool.query("INSERT INTO promo_codes(code,max_uses) VALUES('LAST',1),('OTHER_A',10),('OTHER_B',10)");
 const a=await pending('one@example.org'),b=await pending('two@example.org');
 const claimed=await Promise.all([claimPromo(pool,a,'LAST'),claimPromo(pool,b,'LAST')]);assert.equal(claimed.filter(Boolean).length,1);
 assert.equal((await pool.query("SELECT times_used FROM promo_codes WHERE code='LAST'")).rows[0].times_used,1);
 const c=await pending('SAME@example.org'),d=await pending(' same@example.org ');
 const same=await Promise.all([claimPromo(pool,c,'OTHER_A'),claimPromo(pool,d,'OTHER_B')]);assert.equal(same.filter(Boolean).length,1);
 for(const accepted of [...claimed,...same].filter(Boolean))assert.equal((await pool.query('SELECT count(*)::int n FROM fulfillment_jobs WHERE submission_id=$1',[accepted.id])).rows[0].n,3);
});
test('a reclaimed job rejects stale results and heartbeats while the new worker retains ownership',async()=>{
 await only('generation');const id=await accepted();const stale=await jobs.claim(pool,'generation');assert.equal(stale.submission_id,id);
 await pool.query("UPDATE fulfillment_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[stale.id]);
 const fresh=await jobs.claim(pool,'generation');assert.notEqual(fresh.lease_token,stale.lease_token);
 assert.equal(await jobs.renew(pool,stale),false);assert.equal(await jobs.renew(pool,fresh),true);
 await assert.rejects(jobs.persist(pool,stale,id,{grant_body:'stale output'}),/lease lost/);
 await jobs.persist(pool,fresh,id,{grant_body:'current output'});await jobs.complete(pool,stale);
 assert.equal((await pool.query('SELECT state FROM fulfillment_jobs WHERE id=$1',[fresh.id])).rows[0].state,'running');
 await jobs.complete(pool,fresh);assert.equal((await row(id)).grant_body,'current output');
});
test('restart after a saved result completes the existing job without another generation call',async()=>{
 await only('generation');const id=await accepted();const interrupted=await jobs.claim(pool,'generation');
 await jobs.persist(pool,interrupted,id,{status:'draft_ready',grant_generated_at:new Date().toISOString(),grant_body:'already saved'});
 await pool.query("UPDATE fulfillment_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[interrupted.id]);
 let calls=0;await jobs.runOne(pool,'generation',{generation:async()=>calls++});assert.equal(calls,0);
 assert.equal((await pool.query('SELECT state FROM fulfillment_jobs WHERE id=$1',[interrupted.id])).rows[0].state,'succeeded');
});
test('transient failures retry within a fixed budget and abandoned final attempts become visible',async()=>{
 await only('generation');const id=await accepted();let calls=0;
 const handlers={generation:async()=>{calls++;throw new Error('Synthetic provider failure with private details');}};
 for(let i=0;i<3;i++){await jobs.runOne(pool,'generation',handlers);await pool.query("UPDATE fulfillment_jobs SET available_at=now()-interval '1 second' WHERE submission_id=$1",[id]);}
 const failed=(await pool.query("SELECT * FROM fulfillment_jobs WHERE submission_id=$1 AND kind='generation'",[id])).rows[0];
 assert.equal(failed.state,'failed');assert.equal(failed.attempts,3);assert.equal(failed.last_error,'processing_failed');
 assert.equal(await jobs.runOne(pool,'generation',handlers),false);assert.equal(calls,3);
 const orphan=await accepted();const lease=await jobs.claim(pool,'generation');
 await pool.query("UPDATE fulfillment_jobs SET attempts=max_attempts,lease_until=now()-interval '1 second' WHERE id=$1",[lease.id]);
 assert.equal(await jobs.claim(pool,'generation'),null);
 assert.equal((await pool.query("SELECT state FROM fulfillment_jobs WHERE submission_id=$1 AND kind='generation'",[orphan])).rows[0].state,'failed');
});
test('old receipt jobs require manual investigation, and an unpaid order cannot trigger work',async()=>{
 await only('confirmation');const id=await accepted();
 await pool.query("UPDATE fulfillment_jobs SET created_at=now()-interval '24 hours' WHERE submission_id=$1 AND kind='confirmation'",[id]);
 let calls=0;await jobs.runOne(pool,'confirmation',{confirmation:async()=>calls++});assert.equal(calls,0);
 assert.equal((await pool.query("SELECT state FROM fulfillment_jobs WHERE submission_id=$1 AND kind='confirmation'",[id])).rows[0].state,'failed');
 await only('generation');const unpaid=await pending();await jobs.enqueue(pool,unpaid);
 await jobs.runOne(pool,'generation',{generation:async()=>calls++});assert.equal(calls,0);
});
test('queue reporting and retry require admin authentication and same-origin writes',async()=>{
 assert.equal((await fetch(base+'/admin/api/fulfillment')).status,401);
 assert.equal((await fetch(base+'/admin/fulfillment')).status,401);
 const report=await fetch(base+'/admin/api/fulfillment',{headers:{Authorization:auth}});assert.equal(report.status,200);assert.equal((await report.json()).reviewCapacityUpperBound,10);
 const failed=(await pool.query("SELECT id FROM fulfillment_jobs WHERE state='failed' AND kind='generation' LIMIT 1")).rows[0];
 const post=from=>fetch(base+'/admin/api/fulfillment/'+failed.id+'/retry',{method:'POST',headers:{Authorization:auth,Origin:from,'Content-Type':'application/json'},body:'{}'});
 assert.equal((await post('https://attacker.example')).status,403);assert.equal((await post(origin)).status,200);assert.equal((await post(origin)).status,409);
});
