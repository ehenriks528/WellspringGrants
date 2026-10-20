const path=require('node:path');
const {sameOrigin,limiter}=require('./routes');
const pages=new Set([...require('../marketing/manifest').map(p=>p.path),'/fit','/apply']);
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
function validate(body){
  if(!body||Object.keys(body).some(key=>!['id','event','page','step'].includes(key)))throw new Error('Invalid event.');
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.id||''))throw new Error('Invalid event.');
  if(!pages.has(body.page))throw new Error('Invalid page.');
  if(!['page_view','intake_started','intake_step_completed','fit_started'].includes(body.event))throw new Error('Invalid event.');
  if(body.event.startsWith('intake_')&&body.page!=='/apply')throw new Error('Invalid intake event.');
  if(body.event==='fit_started'&&body.page!=='/fit')throw new Error('Invalid fit event.');
  const step=body.event==='intake_step_completed'?body.step:null;
  if(body.event==='intake_step_completed'&&(!Number.isInteger(step)||step<1||step>4))throw new Error('Invalid step.');
  return {id:body.id,event:body.event,page:body.page,step};
}
function register(app,pool){
  app.post('/api/organic-events',limiter(100),sameOrigin,wrap(async(req,res)=>{
    let event;try{event=validate(req.body);}catch{return res.status(400).json({error:'Invalid event.'});}
    await pool.query('INSERT INTO organic_funnel_events(event_id,event_name,page,step) VALUES($1,$2,$3,$4) ON CONFLICT(event_id) DO NOTHING',[event.id,event.event,event.page,event.step]);
    res.status(204).end();
  }));
  app.get('/admin/funnel',(req,res)=>res.sendFile(path.join(__dirname,'../public-admin/funnel.html')));
  app.get('/admin/funnel.js',(req,res)=>res.sendFile(path.join(__dirname,'../public-admin/funnel.js')));
  app.get('/admin/api/funnel',wrap(async(req,res)=>{
    const days=[7,30,90].includes(Number(req.query.days))?Number(req.query.days):30;
    const [visits,steps,activity,revenue]=await Promise.all([
      pool.query("SELECT page,count(*)::int views FROM organic_funnel_events WHERE event_name='page_view' AND occurred_at>now()-($1 * interval '1 day') GROUP BY page ORDER BY views DESC",[days]),
      pool.query("SELECT step,count(*)::int completions FROM organic_funnel_events WHERE event_name='intake_step_completed' AND occurred_at>now()-($1 * interval '1 day') GROUP BY step ORDER BY step",[days]),
      pool.query("SELECT event_name,count(*)::int events FROM organic_funnel_events WHERE occurred_at>now()-($1 * interval '1 day') GROUP BY event_name",[days]),
      pool.query("SELECT count(*) FILTER(WHERE event='inquiry')::int inquiries,count(*) FILTER(WHERE event='checkout_created')::int checkouts,count(*) FILTER(WHERE event='purchase' AND live)::int paid_orders,COALESCE(sum(amount_cents) FILTER(WHERE event='purchase' AND live),0)::int gross_cents FROM acquisition_events WHERE created_at>now()-($1 * interval '1 day')",[days])
    ]);
    res.json({days,pages:visits.rows,steps:steps.rows,activity:activity.rows,revenue:revenue.rows[0]});
  }));
}
module.exports={register,validate};
