const form=document.getElementById('fit'), result=document.getElementById('result');
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;result.textContent='Saving your inquiry…';
 const body=Object.fromEntries(new FormData(form));body.consent=form.elements.consent.checked;
 // Keep only explicit campaign labels, never emails or full referrer URLs.
 body.source=(new URLSearchParams(location.search).get('utm_source')||'direct').slice(0,100);
 try{
  const response=await fetch('/api/fit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to save. Please try again.');
  result.textContent=data.message;form.querySelectorAll('input,textarea').forEach(input=>input.disabled=true);button.textContent='Inquiry saved';
 }catch(error){result.textContent=error.message;button.disabled=false;}
});
