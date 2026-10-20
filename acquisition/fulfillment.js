const {randomUUID}=require('node:crypto');
const {sameOrigin}=require('./routes');
const clock=require('../public/business-clock');
const kinds=['generation','confirmation','admin_notification'];
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);

// Call inside the transaction that accepts payment or a comp. No process-local
// promise is the only record of work. Existing customer rows are not backfilled.
async function enqueue(client,id) {
  for(const kind of kinds)await client.query(`INSERT INTO fulfillment_jobs(submission_id,kind)
    VALUES($1,$2) ON CONFLICT(submission_id,kind) DO NOTHING`,[id,kind]);
}
async function claim(pool,kind) {
  // A final attempt whose process disappeared must become visible as failed.
  await pool.query(`UPDATE fulfillment_jobs SET state='failed',lease_token=NULL,lease_until=NULL,
    last_error='attempt_limit_after_interruption',updated_at=now()
    WHERE kind=$1 AND state='running' AND lease_until<now() AND attempts>=max_attempts`,[kind]);
  const result=await pool.query(`WITH next_job AS (
    SELECT id FROM fulfillment_jobs WHERE kind=$1 AND attempts<max_attempts
      AND ((state='queued' AND available_at<=now()) OR (state='running' AND lease_until<now()))
    ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE fulfillment_jobs j SET state='running',attempts=attempts+1,
    lease_token=$2,lease_until=now()+interval '2 minutes',updated_at=now()
    FROM next_job WHERE j.id=next_job.id RETURNING j.*`,[kind,randomUUID()]);
  return result.rows[0]||null;
}
async function renew(pool,job) {
  const r=await pool.query(`UPDATE fulfillment_jobs SET lease_until=now()+interval '2 minutes',updated_at=now()
    WHERE id=$1 AND lease_token=$2 AND state='running' AND lease_until>now() RETURNING id`,[job.id,job.lease_token]);
  return r.rows.length===1;
}
async function persist(pool,job,id,fields) {
  const allowed=new Set(['status','grant_draft','grant_body','qa_report','quality_score','client_input_required','grant_generated_at','error']);
  const entries=Object.entries(fields);if(id!==job.submission_id||entries.some(([key])=>!allowed.has(key)))throw new Error('Invalid worker update');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const owned=await client.query(`SELECT id FROM fulfillment_jobs WHERE id=$1 AND lease_token=$2
      AND state='running' AND lease_until>now() FOR UPDATE`,[job.id,job.lease_token]);
    if(!owned.rows.length)throw new Error('Worker lease lost');
    const result=await client.query(`UPDATE submissions SET ${entries.map(([key],i)=>key+'=$'+(i+2)).join(',')}
      WHERE id=$1 RETURNING *`,[id,...entries.map(([,value])=>value)]);
    await client.query('COMMIT');return result.rows[0];
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
async function complete(pool,job) {
  await pool.query(`UPDATE fulfillment_jobs SET state='succeeded',lease_token=NULL,lease_until=NULL,last_error=NULL,updated_at=now()
    WHERE id=$1 AND lease_token=$2 AND state='running' AND lease_until>now()`,[job.id,job.lease_token]);
}
async function fail(pool,job,permanent=false) {
  await pool.query(`UPDATE fulfillment_jobs SET state=CASE WHEN attempts>=max_attempts OR $3 THEN 'failed' ELSE 'queued' END,
    available_at=now()+($4*interval '1 second'),lease_token=NULL,lease_until=NULL,
    last_error=$5,updated_at=now() WHERE id=$1 AND lease_token=$2 AND state='running'`,
    [job.id,job.lease_token,permanent,Math.min(900,60*2**(job.attempts-1)),permanent?'requires_manual_review':'processing_failed']);
}
async function runOne(pool,kind,handlers,options={}) {
  const job=await claim(pool,kind);if(!job)return false;
  const controller=new AbortController();let renewing=false,permanent=false;
  const heartbeat=async()=>{
    if(renewing)return;renewing=true;
    try{if(!await renew(pool,job))controller.abort();}catch{controller.abort();}finally{renewing=false;}
  };
  const timer=setInterval(heartbeat,options.heartbeatMs||20000);timer.unref();
  try{
    const row=(await pool.query('SELECT * FROM submissions WHERE id=$1',[job.submission_id])).rows[0];
    if(!row||!row.paid_at){permanent=true;throw new Error('No accepted order');}
    if(kind==='generation'){
      // A restart after the result was saved must not buy another generation.
      if(!row.grant_generated_at||!row.grant_body){
        if(['delivered','input_required','draft_ready'].includes(row.status)){permanent=true;throw new Error('Inconsistent completed order');}
        await persist(pool,job,row.id,{status:'generating',error:null});
        await handlers.generation(row.id,{signal:controller.signal,throwOnError:true,
          persist:(id,fields)=>persist(pool,job,id,fields)});
        const saved=(await pool.query('SELECT grant_generated_at,grant_body FROM submissions WHERE id=$1',[row.id])).rows[0];
        if(!saved?.grant_generated_at||!saved.grant_body)throw new Error('No saved generation result');
      }
    }else{
      // Provider email idempotency expires after 24h. Do not blindly retry past
      // that boundary when an earlier delivery might have succeeded.
      if(Date.now()-new Date(job.created_at).getTime()>23*3600000){permanent=true;throw new Error('Email retry window expired');}
      if(controller.signal.aborted)throw new Error('Worker lease lost');
      await handlers[kind](row);
    }
    await complete(pool,job);
  }catch{
    await fail(pool,job,permanent);console.error('Fulfillment job needs retry or review:',job.id,kind);
  }finally{clearInterval(timer);controller.abort();}
  return true;
}
function startWorker(pool,handlers) {
  let stopped=false;const active=new Map();
  function tick(){if(stopped)return;
    for(const kind of kinds)if(!active.has(kind)){
      const work=runOne(pool,kind,handlers).catch(()=>console.error('Fulfillment worker unavailable:',kind)).finally(()=>active.delete(kind));
      active.set(kind,work);
    }
  }
  const timer=setInterval(tick,5000);timer.unref();tick();
  return {stop:async()=>{stopped=true;clearInterval(timer);await Promise.allSettled([...active.values()]);}};
}
function register(app,pool) {
  app.get('/admin/fulfillment',(req,res)=>res.sendFile(require('path').join(__dirname,'../public-admin/fulfillment.html')));
  app.get('/admin/fulfillment.js',(req,res)=>res.sendFile(require('path').join(__dirname,'../public-admin/fulfillment.js')));
  app.get('/admin/api/fulfillment',wrap(async(req,res)=>{
    const jobs=(await pool.query(`SELECT j.id,j.submission_id,j.kind,j.state,j.attempts,j.max_attempts,j.last_error,
      j.available_at,j.lease_until,j.created_at,j.updated_at,s.status,s.paid_at
      FROM fulfillment_jobs j JOIN submissions s ON s.id=j.submission_id
      ORDER BY j.created_at DESC LIMIT 200`)).rows;
    const active=(await pool.query(`SELECT count(*)::int count FROM submissions
      WHERE paid_at IS NOT NULL AND status NOT IN ('delivered','pending_payment')`)).rows[0].count;
    res.json({reviewCapacityUpperBound:10,activeOrders:active,jobs:jobs.map(j=>({...j,writingDue:clock.dueAt(j.paid_at).toISOString()}))});
  }));
  app.post('/admin/api/fulfillment/:id/retry',sameOrigin,wrap(async(req,res)=>{
    // Explicit owner action can authorize a new generation attempt; never
    // silently reset the attempt budget on a recurring worker tick.
    const r=await pool.query(`UPDATE fulfillment_jobs SET state='queued',attempts=0,
      available_at=now(),last_error=NULL,updated_at=now()
      WHERE id=$1 AND state='failed' AND (kind='generation' OR created_at>now()-interval '23 hours') RETURNING id`,[req.params.id]);
    res.status(r.rows.length?200:409).json({queued:r.rows.length===1});
  }));
}
module.exports={enqueue,claim,renew,persist,complete,fail,runOne,startWorker,register};
