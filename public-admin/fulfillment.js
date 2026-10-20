(function(){
 const body=document.getElementById('jobs'),error=document.getElementById('error');
 async function load(){
  error.textContent='';
  try{
   const response=await fetch('/admin/api/fulfillment',{cache:'no-store'});if(!response.ok)throw new Error('Queue report could not load.');const data=await response.json();
   const failed=data.jobs.filter(j=>j.state==='failed').length;
   document.getElementById('summary').textContent=data.activeOrders+' accepted orders awaiting delivery. '+failed+' failed jobs need review. Review upper limit: '+data.reviewCapacityUpperBound+'.';
   body.replaceChildren();
   for(const job of data.jobs){
    const row=document.createElement('tr'),order=document.createElement('td'),link=document.createElement('a');
    link.href='/admin/submission/'+encodeURIComponent(job.submission_id);link.textContent=job.submission_id.slice(0,8);order.append(link);row.append(order);
    const due=new Date(job.writingDue);
    for(const value of [job.kind,job.state,job.attempts+'/'+job.max_attempts,due.toLocaleString('en-US',{timeZone:'America/New_York'})]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
    const action=document.createElement('td');
    if(job.state==='failed'&&(job.kind==='generation'||Date.now()-new Date(job.created_at).getTime()<23*3600000)){
     const button=document.createElement('button');button.type='button';button.textContent='Retry failed work';
     button.addEventListener('click',async()=>{button.disabled=true;try{const r=await fetch('/admin/api/fulfillment/'+encodeURIComponent(job.id)+'/retry',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error('This job cannot be retried automatically. Check its state and email retry window.');await load();}catch(e){error.textContent=e.message;button.disabled=false;}});action.append(button);
    }else if(job.state==='failed')action.textContent='Check email receipt manually';
    if(due<Date.now()&&job.kind==='generation'&&job.state!=='succeeded')row.style.background='#fff0e8';
    row.append(action);body.append(row);
   }
  }catch(e){error.textContent=e.message;}
 }
 document.getElementById('refresh').addEventListener('click',load);load();
})();
