const period=document.getElementById('period'),status=document.getElementById('status');
function table(id,rows,keys){
  const root=document.getElementById(id);root.replaceChildren();
  if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=2;td.textContent='No recorded activity in this period.';tr.append(td);root.append(tr);return;}
  rows.forEach(row=>{const tr=document.createElement('tr');keys.forEach(key=>{const td=document.createElement('td');td.textContent=String(row[key]);tr.append(td);});root.append(tr);});
}
async function load(){
  status.textContent='Loading…';
  try{
    const response=await fetch('/admin/api/funnel?days='+period.value,{cache:'no-store'});
    if(!response.ok)throw new Error('Unable to load acquisition metrics.');
    const data=await response.json(),metrics=document.getElementById('metrics');metrics.replaceChildren();
    [['Saved inquiries',data.revenue.inquiries],['Checkout starts',data.revenue.checkouts],['Confirmed paid orders',data.revenue.paid_orders],['Gross live receipts','$'+(data.revenue.gross_cents/100).toFixed(2)]].forEach(([name,value])=>{const card=document.createElement('div');card.className='card';const h=document.createElement('h2'),p=document.createElement('p');h.textContent=String(value);p.textContent=name;card.append(h,p);metrics.append(card);});
    table('pages',data.pages,['page','views']);table('steps',data.steps,['step','completions']);status.textContent='Last '+data.days+' days. Counts begin when this instrumentation is deployed.';
  }catch(error){status.textContent=error.message;}
}
period.addEventListener('change',load);load();
