// Shared browser/server policy. Only coarse labels; no storage or referrer read.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.WellspringAttribution=api;api.install(root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const aliases=Object.freeze({email:'email',outreach:'email',approved_outreach:'email',search:'search',google:'search',bing:'search',organic:'search',referral:'referral',partner:'referral'});
  const campaigns=Object.freeze(['first_customer','resources']);
  const paths=Object.freeze(['/','/pricing','/how-it-works','/about','/contact','/quality-and-ai','/services/nonprofit-grant-writing','/resources','/resources/grant-application-checklist','/resources/grant-writing-cost','/resources/grant-readiness-checklist','/terms','/sample-grant-application','/privacy','/faq','/fit','/apply']);
  const publicPaths=new Set(paths);
  function optedOut(value){return value==='1'||String(value).toLowerCase()==='yes';}
  function disabled(env){return optedOut(env.navigator?.doNotTrack)||optedOut(env.doNotTrack)||env.navigator?.globalPrivacyControl===true;}
  function normalizeLabel(value){
    if(typeof value!=='string'||value.length>80)return 'unattributed';
    const parts=value.trim().toLowerCase().split('/');
    if(parts.length>2)return 'unattributed';
    const source=Object.hasOwn(aliases,parts[0])?aliases[parts[0]]:null;
    if(!source)return 'unattributed';
    return source+(campaigns.includes(parts[1])?'/'+parts[1]:'');
  }
  function fromSearch(search){
    if(typeof search!=='string'||search.length>4096)return 'unattributed';
    const params=new URLSearchParams(search);
    // Ambiguous repeated labels are not a reliable campaign signal.
    if(params.getAll('utm_source').length!==1)return 'unattributed';
    const source=params.get('utm_source');
    const campaign=params.getAll('utm_campaign').length===1?params.get('utm_campaign'):'';
    return normalizeLabel(source+(campaign?'/'+campaign:''));
  }
  function current(env){return disabled(env)?'unattributed':fromSearch(env.location?.search||'');}
  function taggedHref(href,base,label){
    if(typeof href!=='string'||!href||href.startsWith('#'))return href;
    const canonical=normalizeLabel(label);if(canonical==='unattributed')return href;
    let target,origin;try{target=new URL(href,base);origin=new URL(base).origin;}catch{return href;}
    // Keep functional/query-bearing URLs, downloads, private routes and other
    // origins untouched. Never append a landing page's full query to a link.
    if(!['http:','https:'].includes(target.protocol)||target.origin!==origin||target.username||target.password||target.search||!publicPaths.has(target.pathname))return href;
    const [source,campaign]=canonical.split('/');
    target.searchParams.set('utm_source',source);
    if(campaign)target.searchParams.set('utm_campaign',campaign);
    return target.pathname+target.search+target.hash;
  }
  function install(env){
    const document=env.document;if(!document)return;
    const originals=new WeakMap();
    function decorate(anchor){
      if(!anchor?.getAttribute||!anchor.setAttribute)return;
      const href=anchor.getAttribute('href'),previous=originals.get(anchor);
      // Only restore a value we actually tagged; never undo another feature's
      // later change to the same link.
      const original=previous&&href===previous.tagged?previous.original:href;
      const next=taggedHref(original,env.location.href,current(env));
      if(next!==original)originals.set(anchor,{original,tagged:next});else originals.delete(anchor);
      if(next!==href)anchor.setAttribute('href',next);
    }
    const start=()=>document.querySelectorAll('a[href]').forEach(decorate);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
    // Handle dynamically inserted links and a changed privacy preference before
    // ordinary link activation, without replacing normal browser navigation.
    document.addEventListener('click',event=>decorate(event.target?.closest?.('a[href]')));
    document.addEventListener('contextmenu',event=>decorate(event.target?.closest?.('a[href]')));
  }
  return Object.freeze({campaigns,paths,optedOut,disabled,normalizeLabel,fromSearch,current,taggedHref,install});
});
