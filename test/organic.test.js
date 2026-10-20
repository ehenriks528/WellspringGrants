const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const express=require('express');
const basicAuth=require('express-basic-auth');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const drafts=require('../acquisition/drafts');
const funnel=require('../acquisition/funnel');
const {build}=require('../marketing/build');
let db,pool,server,base,cookieA,cookieB;
const origin='https://wellspringgrants.com';
const auth='Basic '+Buffer.from('admin:isolated-draft-test-password').toString('base64');
process.env.ADMIN_PASSWORD='isolated-draft-test-password';process.env.APP_URL=origin;
before(async()=>{
  build();db=new PGlite();
  for(const file of ['acquisition/schema.sql','acquisition/drafts.sql','acquisition/funnel.sql']){await db.exec(fs.readFileSync(file,'utf8'));await db.exec(fs.readFileSync(file,'utf8'));}
  pool={query:async(sql,values)=>{const r=await db.query(sql,values);return {...r,rowCount:r.affectedRows??r.rows.length};}};
  const app=express();app.use(express.json());require('../marketing/routes').register(app);app.use(express.static('public'));app.get('/apply',(req,res)=>res.sendFile(require('node:path').resolve('public/apply.html')));
  app.use('/admin',basicAuth({users:{admin:process.env.ADMIN_PASSWORD}}));
  drafts.register(app,pool);funnel.register(app,pool);
  app.use((err,req,res,next)=>res.status(500).json({error:'Isolated test failure.'}));
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
const post=(url,body,cookie,originValue=origin)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',Origin:originValue,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
test('saved draft requires explicit save consent, rejects cross-origin and forbidden fields',async()=>{
  assert.equal((await post('/api/intake-draft',{fields:{org_name:'Private organization'}})).status,400);
  assert.equal((await post('/api/intake-draft',{consent:true,fields:{org_name:'Private organization'}},null,'https://attacker.example')).status,403);
  assert.equal((await post('/api/intake-draft',{consent:true,fields:{promo_code:'secret-offer'}})).status,400);
  assert.equal((await post('/api/intake-draft',{consent:true,fields:{status:'paid'}})).status,400);
});
test('draft cookie authorizes one encrypted record without exposing its token or answers in logs/URLs',async()=>{
  const saved=await post('/api/intake-draft',{consent:true,fields:{org_name:'Private organization',ein:'12-3456789'}});
  assert.equal(saved.status,200);
  const header=saved.headers.get('set-cookie');assert.match(header,/HttpOnly/i);assert.match(header,/Secure/i);assert.match(header,/SameSite=Strict/i);
  cookieA=header.split(';')[0];
  const body=await saved.json();assert.equal(body.fields,undefined);assert.equal(body.token,undefined);
  const row=(await pool.query('SELECT * FROM intake_drafts')).rows[0];
  assert.ok(!row.encrypted_payload.includes('Private organization'));assert.ok(!row.encrypted_payload.includes('12-3456789'));
  assert.notEqual(row.token_hash,cookieA.split('=')[1]);
  const resumed=await fetch(base+'/api/intake-draft',{headers:{Cookie:cookieA}});
  assert.equal(resumed.headers.get('cache-control'),'no-store');assert.equal((await resumed.json()).fields.ein,'12-3456789');
  const savedB=await post('/api/intake-draft',{consent:true,fields:{org_name:'Other organization'}});
  cookieB=savedB.headers.get('set-cookie').split(';')[0];
  assert.equal((await (await fetch(base+'/api/intake-draft',{headers:{Cookie:cookieB}})).json()).fields.org_name,'Other organization');
  assert.equal((await fetch(base+'/api/intake-draft',{headers:{Cookie:cookieA+'0'}})).status,404);
  assert.equal((await fetch(base+'/api/intake-draft')).status,404);
});
test('updates preserve expiry, expired drafts cannot be resumed, deletion removes only the current draft',async()=>{
  const before=(await pool.query('SELECT expires_at FROM intake_drafts ORDER BY created_at LIMIT 1')).rows[0].expires_at;
  const updated=await post('/api/intake-draft',{consent:true,fields:{org_name:'Changed organization'}},cookieA);
  assert.equal(new Date((await updated.json()).expiresAt).getTime(),new Date(before).getTime());
  await pool.query("UPDATE intake_drafts SET expires_at=now()-interval '1 second' WHERE encrypted_payload<>$1",[(await pool.query('SELECT encrypted_payload FROM intake_drafts ORDER BY created_at DESC LIMIT 1')).rows[0].encrypted_payload]);
  assert.equal((await fetch(base+'/api/intake-draft',{headers:{Cookie:cookieA}})).status,404);
  const deleted=await fetch(base+'/api/intake-draft',{method:'DELETE',headers:{Cookie:cookieB,Origin:origin}});
  assert.equal(deleted.status,200);
  assert.equal((await fetch(base+'/api/intake-draft',{headers:{Cookie:cookieB}})).status,404);
  assert.equal((await pool.query('SELECT count(*)::int n FROM intake_drafts')).rows[0].n,1);
});
test('funnel rejects PII/free-form payloads, deduplicates events and keeps admin metrics private',async()=>{
  const event={id:randomUUID(),event:'page_view',page:'/pricing'};
  assert.equal((await post('/api/organic-events',{...event,email:'private@example.org'})).status,400);
  assert.equal((await post('/api/organic-events',{...event,page:'/pricing?email=private@example.org'})).status,400);
  assert.equal((await post('/api/organic-events',event)).status,204);
  assert.equal((await post('/api/organic-events',event)).status,204);
  assert.equal((await pool.query('SELECT count(*)::int n FROM organic_funnel_events')).rows[0].n,1);
  assert.equal((await fetch(base+'/admin/api/funnel')).status,401);
  assert.equal((await fetch(base+'/admin/funnel')).status,401);
  const report=await (await fetch(base+'/admin/api/funnel',{headers:{Authorization:auth}})).json();
  assert.equal(report.pages[0].views,1);assert.equal(report.revenue.paid_orders,0);assert.equal(report.revenue.gross_cents,0);
  assert.ok(!JSON.stringify(report).includes('Private organization'));
});
test('public pages, canonical redirects, sitemap, private-route index controls and assets work',async()=>{
  const manifest=require('../marketing/manifest');
  for(const page of manifest){
    const response=await fetch(base+page.path);assert.equal(response.status,200,page.path);
    const html=await response.text();
    assert.match(html,new RegExp('rel="canonical" href="https://wellspringgrants.com'+(page.path==='/'?'/':page.path)+'"'));
    assert.equal((html.match(/<h1(?: |>)/g)||[]).length,1,page.path);
    assert.ok(html.indexOf('/source-attribution.js')<html.indexOf('/measurement.js'),'Attribution policy loads before measurement');
    const links=[...html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)].map(m=>m[1]);
    for(const link of new Set(links)){
      if(['/fit','/apply'].includes(link))continue;
      assert.equal((await fetch(base+link)).status,200,page.path+' -> '+link);
    }
    assert.equal((await fetch(base+'/'+page.file,{redirect:'manual'})).status,301);
  }
  const sitemap=await (await fetch(base+'/sitemap.xml')).text();
  assert.equal((sitemap.match(/<loc>/g)||[]).length,manifest.length);
  assert.ok(!sitemap.includes('/apply'));assert.ok(!sitemap.includes('/fit'));
  assert.equal((await fetch(base+'/apply')).headers.get('x-robots-tag'),'noindex, nofollow');
  assert.match(await (await fetch(base+'/robots.txt')).text(),/Sitemap: https:\/\/wellspringgrants.com\/sitemap.xml/);
});
test('privacy headers suppress optional funnel events independently of browser scripts',async()=>{
 const before=(await pool.query('SELECT count(*)::int n FROM organic_funnel_events')).rows[0].n;
 for(const headers of [{DNT:'1'},{DNT:'yes'},{'Sec-GPC':'1'}]){
  const response=await fetch(base+'/api/organic-events',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify({id:randomUUID(),event:'page_view',page:'/pricing'})});
  assert.equal(response.status,204);
 }
 assert.equal((await pool.query('SELECT count(*)::int n FROM organic_funnel_events')).rows[0].n,before);
});
test('sample narrative answers stay within their displayed word limits',()=>{
  const html=fs.readFileSync('public/sample-grant-application.html','utf8');
  let answers=0;
  for(const match of html.matchAll(/data-limit="(\d+)"><div class="answer-text">([\s\S]*?)<\/div>/g)){
    const count=match[2].replace(/<[^>]*>/g,' ').trim().split(/\s+/).length;assert.ok(count<=Number(match[1]));answers++;
  }
  assert.equal(answers,4);
});
