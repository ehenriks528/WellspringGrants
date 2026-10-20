const crypto=require('node:crypto');
const {sameOrigin,limiter}=require('./routes');
const COOKIE='ws_intake_draft';
const allowed=new Set(['org_name','mission','ein','signer_name','signer_title','org_phone','org_street','org_city','org_state','org_zip','tax_exempt','years_operating','track_record','key_staff_credentials','funder_name','grant_program','guidelines_url','grant_deadline','deadline_time','deadline_timezone','non_federal_confirmed','special_requirements','problem_statement','project_description','target_population','expected_outcomes','sustainability_plan','budget_breakdown','amount_requested','annual_budget','financial_period','delivery_format','contact_name','contact_email','referral_source','anything_else']);
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
function token(req){
  const entry=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));
  const value=entry?.slice(COOKIE.length+1);
  return /^[a-f0-9]{64}$/.test(value||'')?value:null;
}
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function key(salt){
  if(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<12)throw new Error('Draft storage is not configured.');
  return Buffer.from(crypto.hkdfSync('sha256',process.env.ADMIN_PASSWORD,salt,'wellspring-intake-draft-v1',32));
}
function encrypt(fields){
  const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(salt),iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(fields),'utf8'),cipher.final()]);
  return Buffer.concat([salt,iv,cipher.getAuthTag(),encrypted]).toString('base64');
}
function decrypt(payload){
  const data=Buffer.from(payload,'base64');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(data.subarray(0,16)),data.subarray(16,28));
  decipher.setAuthTag(data.subarray(28,44));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(44)),decipher.final()]).toString('utf8'));
}
function clean(fields){
  if(!fields||typeof fields!=='object'||Array.isArray(fields))throw new Error('Check the draft fields.');
  const result={};
  for(const [name,value] of Object.entries(fields)){
    if(!allowed.has(name)||typeof value!=='string'||value.length>12000)throw new Error('Check the draft fields.');
    result[name]=value;
  }
  if(Buffer.byteLength(JSON.stringify(result))>70000)throw new Error('The saved draft is too large.');
  return result;
}
function cookieOptions(){return {httpOnly:true,secure:process.env.APP_URL?.startsWith('https://'),sameSite:'strict',path:'/api/intake-draft',maxAge:7*86400000};}
async function discard(pool,req,res){
  const value=token(req);
  if(value)await pool.query('DELETE FROM intake_drafts WHERE token_hash=$1',[hash(value)]);
  res.clearCookie(COOKIE,{...cookieOptions(),maxAge:undefined});
}
function register(app,pool){
  app.use('/api/intake-draft',(req,res,next)=>{res.set('Cache-Control','no-store');res.set('Vary','Cookie');next();});
  app.get('/api/intake-draft',wrap(async(req,res)=>{
    const value=token(req);
    if(!value)return res.status(404).json({saved:false});
    const result=await pool.query('SELECT encrypted_payload,expires_at FROM intake_drafts WHERE token_hash=$1 AND expires_at>now()',[hash(value)]);
    if(!result.rows[0])return res.status(404).json({saved:false});
    try{return res.json({saved:true,fields:decrypt(result.rows[0].encrypted_payload),expiresAt:result.rows[0].expires_at});}
    catch{return res.status(410).json({saved:false,error:'This saved draft is no longer available. Please enter your information again.'});}
  }));
  app.post('/api/intake-draft',limiter(60),sameOrigin,wrap(async(req,res)=>{
    if(req.body.consent!==true)return res.status(400).json({error:'Choose Save draft to consent to storing it for up to seven days.'});
    let fields;try{fields=clean(req.body.fields);}catch(error){return res.status(400).json({error:error.message});}
    let value=token(req);
    if(value){
      const exists=await pool.query('SELECT 1 FROM intake_drafts WHERE token_hash=$1 AND expires_at>now()',[hash(value)]);
      if(!exists.rows.length)value=null;
    }
    value=value||crypto.randomBytes(32).toString('hex');
    const result=await pool.query('INSERT INTO intake_drafts(token_hash,encrypted_payload) VALUES($1,$2) ON CONFLICT(token_hash) DO UPDATE SET encrypted_payload=EXCLUDED.encrypted_payload,updated_at=now() RETURNING expires_at',[hash(value),encrypt(fields)]);
    const options=cookieOptions();
    options.maxAge=Math.max(0,new Date(result.rows[0].expires_at).getTime()-Date.now());
    res.cookie(COOKIE,value,options);
    res.json({saved:true,expiresAt:result.rows[0].expires_at});
  }));
  app.delete('/api/intake-draft',sameOrigin,wrap(async(req,res)=>{await discard(pool,req,res);res.json({deleted:true});}));
}
function startCleanup(pool){
  const cleanup=()=>pool.query('DELETE FROM intake_drafts WHERE expires_at<=now()').catch(()=>console.error('Expired-draft cleanup could not complete.'));
  cleanup();
  const timer=setInterval(cleanup,6*3600000);timer.unref();return timer;
}
module.exports={register,startCleanup,clean,encrypt,decrypt,discard};
