const {test}=require('node:test');
const assert=require('node:assert/strict');
const pages=require('../marketing/pages');
const {html}=require('../marketing/build');
const offer=require('../marketing/service');
const graph=source=>JSON.parse(source.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
test('service and pricing metadata describe the same visible fixed-price writing offer without invented availability or ratings',()=>{
 for(const path of ['/pricing','/services/nonprofit-grant-writing']){
  const source=html(pages.find(p=>p.path===path));const nodes=graph(source);const service=nodes.find(n=>n['@type']==='Service');const page=nodes.find(n=>n['@type']==='WebPage');
  assert.equal(page.mainEntity['@id'],service['@id']);assert.equal(service.offers.price,offer.amountCents/100);assert.equal(service.offers.priceCurrency,'USD');
  assert.equal(service.offers.url,offer.origin+'/pricing');assert.equal(service.provider['@id'],offer.origin+'/#organization');
  assert.match(source,/\$450/);assert.match(service.description,/human review/);
  assert.equal(service.offers.availability,undefined);assert.equal(service.aggregateRating,undefined);assert.equal(service.offers.priceValidUntil,undefined);
 }
 const other=graph(html(pages.find(p=>p.path==='/about')));assert.ok(!other.some(n=>n['@type']==='Service'));
});
test('resource breadcrumb schema matches the linked visible hierarchy; other pages have no invented parent',()=>{
 for(const p of pages.filter(p=>p.path!=='/')){
  const source=html(p);const breadcrumb=graph(source).find(n=>n['@type']==='BreadcrumbList').itemListElement;
  const expected=['/',...(p.path.startsWith('/resources/')?['/resources']:[]),p.path];
  assert.deepEqual(breadcrumb.map(i=>i.item),expected.map(path=>offer.origin+path));assert.deepEqual(breadcrumb.map(i=>i.position),expected.map((_,i)=>i+1));
  const nav=source.match(/<nav class="wrap breadcrumbs".*?<\/nav>/s)[0];
  if(expected.length===3)assert.match(nav,/<a href="\/resources">Resources<\/a>/);
  assert.match(nav,/aria-current="page"/);assert.match(nav,/aria-label="Breadcrumb"/);
 }
 assert.ok(!graph(html(pages[0])).some(n=>n['@type']==='BreadcrumbList'));
});
