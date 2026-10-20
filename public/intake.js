(function(){
  const form=document.getElementById('application-intake');
  if(!form)return;
  const panels=[...form.querySelectorAll('[data-intake-step]')];
  const tools=document.querySelector('.intake-tools'),nav=document.querySelector('.progress-steps');
  const error=document.getElementById('intake-error'),status=document.getElementById('draft-status');
  const resume=document.getElementById('resume-draft'),discard=document.getElementById('discard-draft');
  const summary=document.getElementById('review-summary'),estimate=document.getElementById('delivery-estimate');
  const checkoutButton=document.getElementById('checkout-submit'),availabilityNotice=document.getElementById('order-availability');
  let ordersAvailable=false;
  checkoutButton.disabled=true;
  fetch('/api/order-availability',{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw new Error('Unavailable');
    ordersAvailable=(await response.json()).acceptingOrders===true;
    checkoutButton.disabled=!ordersAvailable;
    if(availabilityNotice)availabilityNotice.hidden=ordersAvailable;
  }).catch(()=>{if(availabilityNotice)availabilityNotice.hidden=false;});
  let step=0,saved=null,dirty=false,maxVisited=0,editVersion=0;
  form.noValidate=true;
  document.querySelectorAll('.intake-enhanced').forEach(el=>el.hidden=false);
  function updateLocation(){form.elements.org_location.value=[form.elements.org_city.value.trim(),form.elements.org_state.value.trim()].filter(Boolean).join(', ');}
  function validate(panel){
    updateLocation();
    const invalid=[...panel.querySelectorAll('input,textarea,select')].find(el=>!el.checkValidity());
    if(invalid){invalid.reportValidity();invalid.focus();return false;}
    return true;
  }
  function show(index,focus=true){
    step=Math.max(0,Math.min(index,panels.length-1));maxVisited=Math.max(maxVisited,step);
    panels.forEach((panel,i)=>panel.hidden=i!==step);
    nav.querySelectorAll('button').forEach((button,i)=>{
      if(i===step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
      button.disabled=i>maxVisited;
    });
    form.querySelector('[data-back]').hidden=step===0;
    form.querySelector('[data-next]').hidden=step===panels.length-1;
    document.getElementById('checkout-submit').hidden=step!==panels.length-1;
    document.getElementById('step-status').textContent='Step '+(step+1)+' of '+panels.length;
    if(step===panels.length-1)renderSummary();
    if(focus){panels[step].setAttribute('tabindex','-1');panels[step].focus();panels[step].scrollIntoView({block:'start',behavior:'auto'});}
  }
  function renderSummary(){
    updateLocation();summary.replaceChildren();
    const fields=[['Organization',form.elements.org_name.value],['Funder',form.elements.funder_name.value],['Program',form.elements.grant_program.value],['Requested funding',form.elements.amount_requested.value?'$'+Number(form.elements.amount_requested.value).toLocaleString():'Not entered'],['Funder deadline',[form.elements.grant_deadline.value,form.elements.deadline_time.value,form.elements.deadline_timezone.value].filter(Boolean).join(' ')],['Delivery email',form.elements.contact_email.value||'Enter your email above']];
    fields.forEach(([label,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value||'Not entered';summary.append(dt,dd);});
    const due=window.WellspringClock.dueAt();
    estimate.textContent='If payment and complete intake were received now, estimated writing delivery would be '+window.WellspringClock.display(due)+'. Your own review, attachments and submission still need time.';
  }
  form.querySelector('[data-next]').addEventListener('click',()=>{if(validate(panels[step])){window.wellspringMeasure?.('intake_step_completed',step+1);show(step+1);}});
  form.querySelector('[data-back]').addEventListener('click',()=>show(step-1));
  nav.querySelectorAll('button').forEach((button,i)=>button.addEventListener('click',()=>{if(i<step||validate(panels[step]))show(i);}));
  form.addEventListener('input',()=>{editVersion++;dirty=true;window.wellspringMeasure?.('intake_started');if(step===panels.length-1)renderSummary();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();error.textContent='';
    if(step<panels.length-1){if(validate(panels[step])){window.wellspringMeasure?.('intake_step_completed',step+1);show(step+1);}return;}
    if(!ordersAvailable){error.textContent='Online orders are temporarily unavailable. You can save a draft or request a grant-fit review.';error.focus();return;}
    for(let i=0;i<panels.length;i++){
      const invalid=[...panels[i].querySelectorAll('input,textarea,select')].find(el=>!el.checkValidity());
      if(invalid){show(i);invalid.reportValidity();invalid.focus();return;}
    }
    updateLocation();
    window.wellspringMeasure?.('intake_step_completed',4);
    const button=document.getElementById('checkout-submit');
    button.disabled=true;button.textContent='Preparing secure checkout…';
    try{
      // A server validation error stays on this page; answers are never placed in a URL.
      const response=await fetch('/checkout',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams(new FormData(form)).toString()});
      const data=await response.json();
      if(!response.ok||!data.redirect)throw new Error(data.error||'Unable to start checkout. Please try again or contact support.');
      const target=new URL(data.redirect,location.origin);
      if(target.origin!==location.origin&&target.hostname!=='checkout.stripe.com')throw new Error('Unexpected checkout destination. Contact support.');
      dirty=false;location.assign(target.href);
    }catch(err){error.textContent=err.message;error.focus();button.disabled=!ordersAvailable;button.textContent='Continue to Payment — $450 →';}
  });
  async function request(method,body){
    const response=await fetch('/api/intake-draft',{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Draft saving is unavailable. Your answers are still on this page.');
    return data;
  }
  document.getElementById('save-draft').addEventListener('click',async event=>{
    const button=event.currentTarget;const savedVersion=editVersion;button.disabled=true;
    status.textContent='Saving your encrypted draft…';
    try{
      const fields={};
      for(const element of form.querySelectorAll('input,textarea,select')){
        if(!element.name||['org_location','promo_code','promo_valid','purchase_terms_confirmed'].includes(element.name))continue;
        if(['checkbox','radio'].includes(element.type)&&!element.checked)continue;
        fields[element.name]=element.value;
      }
      const result=await request('POST',{consent:true,fields});
      status.textContent='Draft saved. Return to this page in the same browser before '+new Date(result.expiresAt).toLocaleDateString()+'. Saving does not start an order or reserve a delivery slot.';
      discard.hidden=false;
      if(editVersion===savedVersion)dirty=false;else status.textContent+=' You have newer changes on this page; save again to include them.';
    }catch(err){status.textContent=err.message;}finally{button.disabled=false;}
  });
  resume.addEventListener('click',()=>{
    if(!saved)return;
    for(const [name,value] of Object.entries(saved)){
      const controls=form.querySelectorAll('[name="'+name+'"]');
      controls.forEach(el=>{if(['radio','checkbox'].includes(el.type))el.checked=el.value===value;else el.value=value;});
    }
    saved=null;resume.hidden=true;status.textContent='Saved answers restored. Please review that the information is still current.';dirty=false;show(0);
  });
  discard.addEventListener('click',async()=>{
    try{await request('DELETE');saved=null;resume.hidden=true;discard.hidden=true;status.textContent='Saved server copy deleted. Answers currently on this page are unchanged.';}
    catch(err){status.textContent=err.message;}
  });
  fetch('/api/intake-draft',{cache:'no-store'}).then(async response=>{
    if(!response.ok)return;
    const data=await response.json();saved=data.fields;resume.hidden=false;discard.hidden=false;
    status.textContent='A saved draft is available in this browser until '+new Date(data.expiresAt).toLocaleDateString()+'. Choose Resume to load it.';
  }).catch(()=>{});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  show(0,false);
})();
