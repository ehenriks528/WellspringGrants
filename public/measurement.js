(function(){
  if(navigator.doNotTrack==='1'||!window.crypto?.randomUUID)return;
  const sent=new Set();
  window.wellspringMeasure=function(event,step){
    const signature=event+':'+(step||'');
    if(sent.has(signature))return;
    sent.add(signature);
    const body={id:crypto.randomUUID(),event,page:location.pathname};
    if(step)body.step=step;
    fetch('/api/organic-events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true}).catch(()=>{});
  };
  window.wellspringMeasure('page_view');
})();
