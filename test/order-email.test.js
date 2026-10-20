const {test,after}=require('node:test');
const assert=require('node:assert/strict');
process.env.RESEND_API_KEY='re_synthetic_never_sent';
const originalFetch=global.fetch;const requests=[];let reject=false;
global.fetch=async(url,options)=>{
 assert.equal(String(url),'https://api.resend.com/emails');
 requests.push({body:JSON.parse(options.body),key:new Headers(options.headers).get('idempotency-key')});
 return new Response(JSON.stringify(reject?{name:'validation_error',message:'Synthetic rejection'}:{id:'synthetic-email-id'}),{status:reject?422:200,headers:{'Content-Type':'application/json'}});
};
const mail=require('../sendEmail');
after(()=>{global.fetch=originalFetch;});
const order={id:'synthetic-order',org_name:'Synthetic organization',funder_name:'Synthetic funder',contact_name:'<script>synthetic</script>',contact_email:'synthetic@example.org',paid_at:'2026-10-19T13:00:00Z',submitted_at:'2026-10-19T13:00:00Z',delivery_format:'word',quality_score:9,doc_url:'https://docs.google.com/document/d/synthetic/edit'};
test('order emails use stable, distinct idempotency keys and escape synthetic names',async()=>{
 await mail.sendConfirmationEmail(order);await mail.sendConfirmationEmail(order);
 assert.equal(requests[0].key,'order-confirmation/synthetic-order');assert.deepEqual(requests[0],requests[1]);
 assert.ok(!requests[0].body.html.includes('<script>synthetic</script>'));
 await mail.sendDeliveryEmail(order,Buffer.from('Synthetic Word payload'));
 assert.equal(requests[2].key,'order-delivery/synthetic-order');assert.equal(requests[2].body.attachments.length,1);
 await mail.sendAdminNotificationEmail(order);assert.equal(requests[3].key,'order-admin/synthetic-order');
});
test('provider rejection is visible to the durable worker for every order email type',async()=>{
 reject=true;
 await assert.rejects(mail.sendConfirmationEmail(order));
 await assert.rejects(mail.sendDeliveryEmail(order));
 await assert.rejects(mail.sendAdminNotificationEmail(order));
});
