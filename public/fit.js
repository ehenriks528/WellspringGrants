const form=document.getElementById('fit'), result=document.getElementById('result');
form.addEventListener('input',()=>window.wellspringMeasure?.('fit_started'),{once:true});
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;result.textContent='Saving your inquiry…';
 const body=Object.fromEntries(new FormData(form));body.consent=form.elements.consent.checked;
 // Shared policy emits only coarse client labels, and respects DNT/GPC.
 body.source=window.WellspringAttribution?.current(window)||'unattributed';
 try{
  const response=await fetch('/api/fit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),referrerPolicy:'origin'});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to save. Please try again.');
  result.textContent=data.message;form.querySelectorAll('input,textarea').forEach(input=>input.disabled=true);button.textContent='Inquiry saved';
 }catch(error){result.textContent=error.message;button.disabled=false;}
});
