const {randomUUID} = require('node:crypto');
const {lead, text, email, url, date, signLead, readLead} = require('./validation');
const {acknowledge} = require('./email');
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
function sameOrigin(req,res,next) {
  const expected = new URL(process.env.APP_URL).origin;
  if (req.headers.origin !== expected) return res.status(403).json({error:'Please use the Wellspring website to submit changes.'});
  next();
}
function limiter(max = 8) {
  const requests = new Map();
  return (req,res,next) => {
    const now=Date.now();
    for (const [key,value] of requests) if(value.until < now) requests.delete(key);
    const key=req.ip, item=requests.get(key)||{count:0,until:now+3600000};
    if (++item.count>max) return res.status(429).json({error:'Too many attempts. Please try again later.'});
    requests.set(key,item); next();
  };
}
function register(app,pool,acknowledger=acknowledge) {
  app.get('/fit',(req,res)=>res.sendFile(require('path').join(__dirname,'../public/fit.html')));
  app.get('/privacy',(req,res)=>res.sendFile(require('path').join(__dirname,'../public/privacy.html')));
  app.post('/api/fit',limiter(),sameOrigin,wrap(async(req,res)=>{
    if(req.body.company_fax) return res.status(400).json({error:'Unable to submit inquiry.'});
    let data;
    try { data=lead(req.body); } catch(error) { return res.status(400).json({error:error.message}); }
    const id=randomUUID(), keys=Object.keys(data);
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      // Advisory lock serializes repeat inquiries from the same address.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[data.email]);
      const recent=await client.query("SELECT id FROM acquisition_leads WHERE email=$1 AND created_at>now()-interval '1 hour'",[data.email]);
      if(recent.rows.length>=3) { await client.query('ROLLBACK'); return res.status(429).json({error:'Your recent inquiries are saved. Please wait before sending another.'}); }
      await client.query(`INSERT INTO acquisition_leads (id,${keys.join(',')},consent_at,follow_up_at) VALUES ($1,${keys.map((_,i)=>`$${i+2}`).join(',')},now(),now()+interval '1 day')`,[id,...Object.values(data)]);
      await client.query("INSERT INTO acquisition_events (lead_id,event) VALUES ($1,'inquiry')",[id]);
      await client.query('COMMIT');
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    res.cookie('ws_lead',signLead(id,process.env.ADMIN_PASSWORD),{httpOnly:true,secure:process.env.APP_URL.startsWith('https://'),sameSite:'lax',maxAge:30*86400000,path:'/'});
    // Persist first; provider failure never loses the inquiry or masquerades as delivery.
    try { await acknowledger(pool,id); } catch { console.error('Fit acknowledgment pending retry:',id); }
    res.status(201).json({saved:true,message:'Your inquiry is saved. We’ll review your grant fit and reply by email.'});
  }));
  app.get('/admin/leads',(req,res)=>res.sendFile(require('path').join(__dirname,'../public-admin/leads.html')));
  app.get('/admin/api/leads',wrap(async(req,res)=>{
    const [leads,outreach,metrics]=await Promise.all([
      pool.query('SELECT * FROM acquisition_leads ORDER BY created_at DESC LIMIT 500'),
      pool.query('SELECT * FROM acquisition_outreach ORDER BY created_at DESC LIMIT 500'),
      pool.query(`SELECT count(*) FILTER(WHERE event='inquiry')::int inquiries,
        count(*) FILTER(WHERE event='checkout_created')::int checkouts,
        count(*) FILTER(WHERE event='purchase' AND live)::int paid_customers,
        COALESCE(sum(amount_cents) FILTER(WHERE event='purchase' AND live),0)::int revenue_cents
        FROM acquisition_events`)]);
    res.json({leads:leads.rows,outreach:outreach.rows,metrics:metrics.rows[0]});
  }));
  app.post('/admin/api/leads/:id',sameOrigin,wrap(async(req,res)=>{
    let status,notes,follow;
    try {
      status=text(req.body.status,30); notes=text(req.body.notes||'',5000); follow=date(req.body.follow_up_at);
      if(!['new','reviewing','qualified','not_fit','replied','paid','closed'].includes(status)) throw new Error();
    } catch {return res.status(400).json({error:'Invalid lead update.'});}
    const result=await pool.query('UPDATE acquisition_leads SET status=$2,notes=$3,follow_up_at=$4 WHERE id=$1 RETURNING id',[req.params.id,status,notes,follow]);
    res.status(result.rowCount?200:404).json({saved:!!result.rowCount});
  }));
  app.post('/admin/api/leads/:id/retry-ack',sameOrigin,wrap(async(req,res)=>{
    await acknowledger(pool,req.params.id); res.json({accepted:true});
  }));
  app.post('/admin/api/suppress',sameOrigin,wrap(async(req,res)=>{
    let address; try {address=email(req.body.email);}catch{return res.status(400).json({error:'Invalid email.'});}
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO acquisition_suppressions(email) VALUES($1) ON CONFLICT DO NOTHING',[address]);
      await client.query("UPDATE acquisition_outreach SET status='suppressed',follow_up_at=NULL WHERE email=$1",[address]);
      await client.query('UPDATE acquisition_leads SET suppressed=true,follow_up_at=NULL WHERE email=$1',[address]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    res.json({suppressed:true});
  }));
  app.post('/admin/api/outreach',sameOrigin,wrap(async(req,res)=>{
    let record;
    try {
      record={org_name:text(req.body.org_name,160),email:email(req.body.email),contact_source:url(req.body.contact_source),demand_source:url(req.body.demand_source),funder_source:url(req.body.funder_source),eligibility_evidence:text(req.body.eligibility_evidence,5000),deadline:date(req.body.deadline),subject:text(req.body.subject,160),body:text(req.body.body,6000)};
      if(Object.values(record).some(v=>!v)) throw new Error();
    }catch{return res.status(400).json({error:'Complete all evidence, contact, deadline and draft fields.'});}
    const keys=Object.keys(record),id=randomUUID();
    await pool.query(`INSERT INTO acquisition_outreach(id,${keys.join(',')},verified_at) VALUES($1,${keys.map((_,i)=>`$${i+2}`).join(',')},now())`,[id,...Object.values(record)]);
    res.status(201).json({id,status:'draft'});
  }));
  app.post('/admin/api/outreach/:id/:action',sameOrigin,wrap(async(req,res)=>{
    const action=req.params.action;
    if(!['approve','mark-sent','replied','close'].includes(action))return res.status(400).json({error:'Invalid action.'});
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const result=await client.query('SELECT * FROM acquisition_outreach WHERE id=$1 FOR UPDATE',[req.params.id]), record=result.rows[0];
      if(!record){await client.query('ROLLBACK');return res.status(404).json({error:'Not found.'});}
      const suppressed=await client.query('SELECT 1 FROM acquisition_suppressions WHERE email=$1',[record.email]);
      if(suppressed.rowCount || record.status==='suppressed'){await client.query('ROLLBACK');return res.status(409).json({error:'Contact is suppressed.'});}
      if(action==='approve') {
        if(record.status!=='draft' || new Date(record.deadline).getTime()<Date.now() || Date.now()-new Date(record.verified_at)>7*86400000 || !process.env.OUTREACH_POSTAL_ADDRESS || !record.body.includes(process.env.OUTREACH_POSTAL_ADDRESS) || !/reply.*stop/i.test(record.body) || !/commercial|advertisement/i.test(record.body)) {
          await client.query('ROLLBACK');return res.status(409).json({error:'Approval requires a fresh verified opportunity, future deadline, configured business postal address in the draft, commercial identification, and reply-to-stop instructions.'});
        }
        await client.query("UPDATE acquisition_outreach SET status='approved',approved_at=now(),approved_by=$2 WHERE id=$1",[record.id,req.auth.user]);
      } else if(action==='mark-sent') {
        if(record.status!=='approved' || req.body.confirmation!=='I sent this approved message manually' || Date.now()-new Date(record.verified_at)>7*86400000 || new Date(record.deadline).getTime()<Date.now()) {
          await client.query('ROLLBACK');return res.status(409).json({error:'Approve a current draft first and confirm the manual send.'});
        }
        await client.query("UPDATE acquisition_outreach SET status='sent',sent_at=now(),follow_up_at=now()+interval '5 days' WHERE id=$1",[record.id]);
      } else {
        await client.query('UPDATE acquisition_outreach SET status=$2,follow_up_at=NULL WHERE id=$1',[record.id,action==='replied'?'replied':'closed']);
      }
      await client.query('INSERT INTO acquisition_audit(record_id,action,actor) VALUES($1,$2,$3)',[record.id,action,req.auth.user]);
      await client.query('COMMIT');res.json({saved:true});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }));
}
async function recordCheckout(pool,req,submissionId,sessionId) {
  const leadId=readLead(req,process.env.ADMIN_PASSWORD);
  await pool.query(`INSERT INTO acquisition_events(lead_id,submission_id,event,external_id) VALUES($1,$2,'checkout_created',$3) ON CONFLICT(external_id) DO NOTHING`,[leadId,submissionId,`checkout/${sessionId}`]);
}
module.exports={register,sameOrigin,limiter,recordCheckout};
