const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {build}=require('../marketing/build');
const {robots,sitemap}=require('../marketing/discovery');
const pages=build();
test('every public marketing page has unique metadata, one H1, sequential headings and valid entity JSON',()=>{
 const titles=new Set(),descriptions=new Set();
 for(const page of pages){
  const html=fs.readFileSync(path.join('public',page.file),'utf8');
  const title=html.match(/<title>(.*?)<\/title>/)[1];
  const description=html.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.ok(!titles.has(title),page.path);titles.add(title);
  assert.ok(!descriptions.has(description),page.path);descriptions.add(description);
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1,page.path);
  const headings=[...html.matchAll(/<h([1-6])[ >]/g)].map(x=>Number(x[1]));
  for(let i=1;i<headings.length;i++)assert.ok(headings[i]<=headings[i-1]+1,page.path+' skipped heading');
  assert.doesNotMatch(html,/<meta[^>]+name="robots"[^>]+noindex/i,page.path);
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
  assert.ok(html.includes('rel="canonical" href="https://wellspringgrants.com'+page.path+'"'));
  for(const image of html.matchAll(/<img\b[^>]*>/g)){
   assert.match(image[0],/\balt="[^"]*"/);assert.match(image[0],/width="\d+"/);assert.match(image[0],/height="\d+"/);
  }
  const graph=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])['@graph'];
  assert.ok(graph.some(x=>x['@type']==='Organization'));
  if(page.path==='/')assert.equal(graph.find(x=>x['@type']==='WebSite').name,'Wellspring Grants');
  for(const article of graph.filter(x=>x['@type']==='Article'))assert.deepEqual(article.image,['https://wellspringgrants.com/social-card.png']);
 }
});
test('generated sitemap and robots match runtime output and expose only canonical marketing routes',()=>{
 assert.equal(fs.readFileSync('public/robots.txt','utf8'),robots());
 const xml=fs.readFileSync('public/sitemap.xml','utf8');assert.equal(xml,sitemap(pages));
 const urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>x[1]);
 assert.equal(urls.length,pages.length);assert.equal(new Set(urls).size,pages.length);
 assert.ok(urls.every(x=>x.startsWith('https://wellspringgrants.com/')));
 assert.ok(!urls.some(x=>/\/apply|\/fit|\/admin|\/api\//.test(x)));
});
test('Open Graph dimensions agree with the compressed PNG and service terms stay unchanged',()=>{
 const png=fs.readFileSync('public/social-card.png');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
 assert.ok(png.length<57008);
 for(const page of pages){const html=fs.readFileSync(path.join('public',page.file),'utf8');assert.ok(html.includes('property="og:image:width" content="1200"'));assert.ok(html.includes('property="og:image:height" content="630"'));}
 const service=require('../marketing/service');assert.equal(service.amountCents,45000);assert.match(service.turnaround,/two business days after payment and complete intake/);
 for(const file of ['public/fit.html','public/apply.html'])assert.match(fs.readFileSync(file,'utf8'),/noindex, nofollow/);
});
