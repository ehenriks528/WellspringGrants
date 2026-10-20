const fs = require('node:fs');
const path = require('node:path');
const service = require('./service');
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const faq = require('./faq');
const pages = [...require('./pages'), require('./sample'), require('./privacy'), {
  path: '/faq', title: 'Grant Writing Service FAQs | Wellspring Grants',
  heading: 'Answers before you start.',
  description: 'Answers about the $450 grant writing service, business-day delivery, revisions, payment, technology use, privacy and nonprofit responsibilities.',
  intro: 'Understand the scope, process and practical details before purchasing writing support.',
  body: '<div class="content faq">' + faq.map(([q,a]) => '<details><summary>' + escape(q) + '</summary><div><p>' + a + '</p></div></details>').join('') + '</div>',
}];
const root = path.join(__dirname,'../public');
const navItems = [['/how-it-works','How it works'],['/sample-grant-application','Sample'],['/pricing','Pricing'],['/resources','Resources'],['/faq','FAQ']];
function nav(current) {
  return navItems.map(([href,label]) => '<a href="' + href + '"' + (current === href ? ' aria-current="page"' : '') + '>' + label + '</a>').join('');
}
function header(current) {
  return '<a class="skip" href="#main">Skip to content</a><header class="site-header"><div class="wrap header-inner"><a class="brand" href="/"><img src="/logo.svg" width="34" height="34" alt="">Wellspring Grants</a><nav class="desktop-nav" aria-label="Main">' + nav(current) + '<a class="button" href="/fit">Check grant fit →</a></nav><details class="mobile-nav"><summary>Menu</summary><nav aria-label="Mobile">' + nav(current) + '<a href="/about">About</a><a href="/fit">Check grant fit →</a></nav></details></div></header>';
}
const footer = '<footer class="site-footer"><div class="wrap"><div class="footer-grid"><div><a class="brand" href="/">Wellspring Grants</a><p>Writing support for small nonprofit teams.<br>A specific opportunity. A defined application.</p><a href="mailto:' + service.email + '">' + service.email + '</a></div><div class="footer-links"><strong>Prepare your application</strong><a href="/services/nonprofit-grant-writing">Nonprofit grant writing</a><a href="/sample-grant-application">Annotated sample</a><a href="/resources">Free resources</a><a href="/pricing">Pricing &amp; scope</a></div><div class="footer-links"><strong>Know the service</strong><a href="/about">About Wellspring</a><a href="/quality-and-ai">Quality &amp; technology</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Service terms</a></div></div><div class="footer-bottom">© 2026 Wellspring Grants · Funding is not guaranteed. Your organization reviews and submits its application.</div></div></footer>';
const closing = '<section class="closing"><div class="wrap"><div><p class="eyebrow">Have an opportunity in mind?</p><h2>Make the next step a clear one.</h2><p>Check fit before buying writing support.</p></div><a class="button" href="/fit">Check your grant fit →</a></div></section>';
function breadcrumbs(page) {
  return [
    {name:'Home',path:'/'},
    ...(page.path.startsWith('/resources/') ? [{name:'Resources',path:'/resources'}] : []),
    {name:page.title.split(' | ')[0],path:page.path},
  ];
}
function html(page) {
  const canonical = service.origin + (page.path === '/' ? '/' : page.path);
  const crumbs = breadcrumbs(page);
  const servicePage = ['/pricing','/services/nonprofit-grant-writing'].includes(page.path);
  const serviceId = service.origin+'/services/nonprofit-grant-writing#service';
  const entity = {
    '@context':'https://schema.org',
    '@graph':[
      {'@type':'Organization','@id':service.origin+'/#organization',name:service.name,url:service.origin+'/',logo:service.origin+'/logo.svg',email:service.email},
      {'@type':page.article ? 'Article':'WebPage','@id':canonical+'#page',url:canonical,name:page.title,headline:page.heading?.replace(/<br>/g,' ')||page.title,description:page.description,
        ...(servicePage ? {mainEntity:{'@id':serviceId}} : {}),
        ...(page.article ? {author:{'@id':service.origin+'/#organization'},publisher:{'@id':service.origin+'/#organization'},datePublished:'2026-10-19'} : {})},
      ...(servicePage ? [{
        '@type':'Service','@id':serviceId,name:'Nonprofit grant application writing',
        url:service.origin+'/services/nonprofit-grant-writing',
        serviceType:'Non-federal nonprofit grant application writing',
        description:'Writing for one selected foundation, community foundation or corporate application, with AI-assisted drafting, human review and editable delivery. Your nonprofit supplies the facts and submits to the funder.',
        provider:{'@id':service.origin+'/#organization'},
        offers:{'@type':'Offer',price:service.amountCents/100,priceCurrency:service.currency.toUpperCase(),
          url:service.origin+'/pricing',seller:{'@id':service.origin+'/#organization'}},
      }] : []),
      ...(page.path === '/' ? [] : [{'@type':'BreadcrumbList',itemListElement:crumbs.map((crumb,index)=>({
        '@type':'ListItem',position:index+1,name:crumb.name,item:service.origin+crumb.path,
      }))}]),
    ],
  };
  let body = page.body;
  if (page.path === '/sample-grant-application') {
    body = body.replace(/(<div class="answer-text">)([\s\S]*?)(<\/div><p class="small" data-word-count><\/p>)/g,(_,open,answer,close) => {
      const count = answer.replace(/<[^>]*>/g,' ').trim().split(/\s+/).length;
      return open + answer + close.replace('data-word-count></p>','data-word-count>' + count + ' words</p>');
    });
  }
  const breadcrumbHtml = '<nav class="wrap breadcrumbs" aria-label="Breadcrumb">'+crumbs.map((crumb,index)=>
    index===crumbs.length-1 ? '<span aria-current="page">'+escape(crumb.name)+'</span>' : '<a href="'+crumb.path+'">'+escape(crumb.name)+'</a>'
  ).join(' <span aria-hidden="true">/</span> ')+'</nav>';
  const content = page.type === 'home' ? body :
    breadcrumbHtml+'<section class="page-hero"><div class="wrap"><p class="eyebrow">' + (page.article?'A practical resource':'Wellspring Grants') + '</p><h1>' + page.heading + '</h1><p class="lead">' + page.intro + '</p></div></section><section class="section white"><div class="wrap' + (page.article?' article-layout':'') + '">' + (page.article?'<article class="content">':'') + body + (page.article?'</article><aside class="sidebar"><h2>One application.<br>$450.</h2><p class="small">Funder-targeted writing, human review and editable delivery.</p><a class="button" href="/fit">Check fit →</a><a href="/pricing">Pricing and scope</a><a href="/sample-grant-application">See the sample</a><a href="/resources">All resources</a></aside>':'') + '</div></section>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escape(page.title) + '</title><meta name="description" content="' + escape(page.description) + '"><link rel="canonical" href="' + canonical + '"><meta property="og:type" content="' + (page.article?'article':'website') + '"><meta property="og:site_name" content="Wellspring Grants"><meta property="og:title" content="' + escape(page.title) + '"><meta property="og:description" content="' + escape(page.description) + '"><meta property="og:url" content="' + canonical + '"><meta property="og:image" content="' + service.origin + '/social-card.png"><meta property="og:image:alt" content="Wellspring Grants. Grant writing for small nonprofit teams."><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/logo.svg" type="image/svg+xml"><link rel="stylesheet" href="/organic.css"><script type="application/ld+json">' + JSON.stringify(entity).replace(/</g,'\\u003c') + '</script><script src="/measurement.js" defer></script><script src="/organic.js" defer></script></head><body>' + header(page.path) + '<main id="main">' + content + '</main>' + closing + footer + '</body></html>\n';
}
function build() {
  const manifest=[];
  for (const page of pages) {
    const relative=page.file||(page.path.slice(1)+'.html');
    const target=path.join(root,relative);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,html(page));
    manifest.push({path:page.path,file:relative,title:page.title,description:page.description});
  }
  const text = require('./sample').body.replace(/<\/(?:p|h2|li|tr)>/g,'\n\n').replace(/<br\s*\/?>/g,'\n').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/[ \t]+/g,' ').trim();
  fs.writeFileSync(path.join(root,'sample-grant-application.txt'),'WELLSPRING GRANTS — FICTIONAL DEMONSTRATION\n\n'+text+'\n');
  fs.writeFileSync(path.join(__dirname,'manifest.js'),'// Generated by npm run build:marketing\nmodule.exports = '+JSON.stringify(manifest,null,2)+';\n');
  return manifest;
}
if (require.main===module) console.log('Built '+build().length+' public pages.');
module.exports={build,html};
