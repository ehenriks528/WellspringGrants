const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const attribution=require('../public/source-attribution');
function browser(href,privacy={}){
 const listeners={};const anchors=[];
 const document={readyState:'complete',querySelectorAll:()=>anchors,addEventListener:(event,fn)=>listeners[event]=fn};
 const env={document,location:new URL(href),navigator:privacy};
 for(const key of ['localStorage','sessionStorage'])Object.defineProperty(env,key,{get(){throw new Error('Browser storage must not be used');}});
 for(const key of ['cookie','referrer'])Object.defineProperty(document,key,{get(){throw new Error('No cookie/referrer access');},set(){throw new Error('No cookie writes');}});
 const anchor=href=>{const node={href,getAttribute:()=>node.href,setAttribute:(_,v)=>node.href=v,closest:()=>node};anchors.push(node);return node;};
 return {env,listeners,anchor};
}
test('coarse source/campaign labels discard personal, unknown and ambiguous values',()=>{
 assert.equal(attribution.fromSearch('?utm_source=approved_outreach&utm_campaign=first_customer&email=private@example.org'),'email/first_customer');
 assert.equal(attribution.fromSearch('?utm_source=google&utm_campaign=resources'),'search/resources');
 for(const value of ['',null,{},'private@example.org','https://example.org/?email=private@example.org','name of a prospect','x'.repeat(200)])assert.equal(attribution.normalizeLabel(value),'unattributed');
 assert.equal(attribution.normalizeLabel('email/private@example.org'),'email');
 for(const query of ['','?utm_source=direct','?utm_campaign=first_customer','?utm_source=private%40example.org','?utm_source=email&utm_source=google'])assert.equal(attribution.fromSearch(query),'unattributed');
 assert.equal(attribution.fromSearch('?utm_source=email&utm_campaign=unknown'),'email');
 assert.equal(attribution.fromSearch('?utm_source=email&utm_campaign=resources&utm_campaign=first_customer'),'email');
});
test('known campaign survives landing → resource → fit without storage or full-query propagation',()=>{
 const landing=browser('https://wellspringgrants.com/?utm_source=approved_outreach&utm_campaign=first_customer&private=never-copy');
 const resource=landing.anchor('/resources/grant-readiness-checklist');attribution.install(landing.env);
 assert.equal(resource.href,'/resources/grant-readiness-checklist?utm_source=email&utm_campaign=first_customer');
 const next=browser(new URL(resource.href,landing.env.location).href),fit=next.anchor('/fit');attribution.install(next.env);
 assert.equal(fit.href,'/fit?utm_source=email&utm_campaign=first_customer');
 const final=browser(new URL(fit.href,next.env.location).href);assert.equal(attribution.current(final.env),'email/first_customer');
 assert.ok(!fit.href.includes('private'));assert.ok(!fit.href.includes('never-copy'));
 const intended=[...require('../marketing/manifest').map(p=>p.path),'/fit','/apply'];assert.deepEqual(new Set(attribution.paths),new Set(intended));
});
test('no-source behavior and privacy preferences suppress labels and optional browser measurement',()=>{
 for(const preferences of [{doNotTrack:'1'},{doNotTrack:'yes'},{globalPrivacyControl:true}]){
  const b=browser('https://wellspringgrants.com/?utm_source=email&utm_campaign=first_customer',preferences),fit=b.anchor('/fit');attribution.install(b.env);
  assert.equal(fit.href,'/fit');assert.equal(attribution.current(b.env),'unattributed');
 }
 const direct=browser('https://wellspringgrants.com/'),fit=direct.anchor('/fit');attribution.install(direct.env);assert.equal(fit.href,'/fit');assert.equal(attribution.current(direct.env),'unattributed');
 const changed=browser('https://wellspringgrants.com/?utm_source=email'),link=changed.anchor('/fit');attribution.install(changed.env);
 assert.ok(link.href.includes('utm_source=email'));changed.env.navigator.doNotTrack='1';changed.listeners.click({target:link});assert.equal(link.href,'/fit');
 const context={window:{WellspringAttribution:attribution,navigator:{doNotTrack:'1'},crypto:{randomUUID:()=>{throw new Error('No event ID under DNT');}}},navigator:{doNotTrack:'1'},fetch:()=>{throw new Error('No measurement under DNT');}};
 vm.runInNewContext(fs.readFileSync('public/measurement.js','utf8'),context);assert.equal(context.window.wellspringMeasure,undefined);
});
test('private, functional, asset and external links stay untouched; other features can still change links',()=>{
 const base='https://wellspringgrants.com/?utm_source=email';
 for(const href of ['/admin','/api/fit','/checkout','/payment-success?session_id=keep','/logo.svg','/sample-grant-application.txt','#questions','mailto:hello@wellspringgrants.com','https://example.org/fit','https://stripe.com/','/fit?purpose=keep'])assert.equal(attribution.taggedHref(href,base,'email/first_customer'),href);
 assert.equal(attribution.taggedHref('/pricing#scope',base,'email'),'/pricing?utm_source=email#scope');
 const b=browser(base),link=b.anchor('/fit');attribution.install(b.env);link.href='/fit?purpose=keep';b.listeners.click({target:link});assert.equal(link.href,'/fit?purpose=keep');
 const dynamic=b.anchor('/pricing');b.listeners.contextmenu({target:dynamic});assert.equal(dynamic.href,'/pricing?utm_source=email');
});
test('measurement fails closed without the policy and stops when privacy preferences change',()=>{
 const script=fs.readFileSync('public/measurement.js','utf8');
 for(const privacy of [{},{doNotTrack:'1'},{globalPrivacyControl:true}]){
  const env=browser('https://wellspringgrants.com/',privacy).env;
  env.crypto={randomUUID:()=>{throw new Error('No event without attribution policy');}};
  vm.runInNewContext(script,{window:env});assert.equal(env.wellspringMeasure,undefined);
 }
 for(const privacy of [{doNotTrack:'1'},{doNotTrack:'yes'},{globalPrivacyControl:true}]){
  const env=browser('https://wellspringgrants.com/fit',privacy).env;
  env.WellspringAttribution=attribution;env.crypto={randomUUID:()=>{throw new Error('No event under privacy preference');}};
  vm.runInNewContext(script,{window:env});assert.equal(env.wellspringMeasure,undefined);
 }
 let calls=0;const env=browser('https://wellspringgrants.com/fit?utm_source=email').env;
 env.WellspringAttribution=attribution;env.crypto={randomUUID:()=> 'local-event-id'};
 vm.runInNewContext(script,{window:env,crypto:env.crypto,location:env.location,fetch:(url,options)=>{calls++;assert.equal(options.referrerPolicy,'origin');assert.ok(!options.body.includes('utm_source'));return Promise.resolve();}});
 assert.equal(calls,1);env.navigator.globalPrivacyControl=true;env.wellspringMeasure('fit_started');assert.equal(calls,1);
});
test('fit submission uses only the normalized label; missing helper remains unattributed',async()=>{
 for(const [prefs,helper,expected] of [[{},attribution,'email/resources'],[{doNotTrack:'1'},attribution,'unattributed'],[{},null,'unattributed']]){
  let onSubmit,request;const result={};const button={};const form={elements:{consent:{checked:true}},addEventListener:(name,fn)=>{if(name==='submit')onSubmit=fn;},querySelector:()=>button,querySelectorAll:()=>[]};
  const env=browser('https://wellspringgrants.com/fit?utm_source=email&utm_campaign=resources&email=private@example.org',prefs).env;env.WellspringAttribution=helper;
  const sandbox={document:{getElementById:id=>id==='fit'?form:result},window:env,FormData:class{*[Symbol.iterator](){yield ['project','Local fixture only'];}},fetch:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({message:'Local only'})};}};
  vm.runInNewContext(fs.readFileSync('public/fit.js','utf8'),sandbox);await onSubmit({preventDefault(){}});
  assert.equal(JSON.parse(request.options.body).source,expected);assert.equal(request.options.referrerPolicy,'origin');assert.ok(!request.options.body.includes('private@example.org'));
 }
});
