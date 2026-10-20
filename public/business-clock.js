// Same pure clock is used by the server, deadline screening, and intake estimate.
// Two Monday–Friday calendar days, with after-hours starts at 09:00 Eastern.
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.WellspringClock=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const zone='America/New_York';
  const formatter=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  function parts(date,timeZone=zone){
    const selected=timeZone===zone?formatter:new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    return Object.fromEntries(selected.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  }
  function civil(p){return Date.UTC(p.year,p.month-1,p.day,p.hour||0,p.minute||0,p.second||0);}
  function instant(p,timeZone=zone){
    let result=civil(p);
    for(let i=0;i<4;i++){const delta=civil(p)-civil(parts(new Date(result),timeZone));if(!delta)break;result+=delta;}
    return new Date(result);
  }
  function weekday(p){return new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay();}
  function next(p){const date=new Date(Date.UTC(p.year,p.month-1,p.day+1));return {...p,year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate()};}
  function isBusiness(p){return ![0,6].includes(weekday(p));}
  function startsAt(value=new Date()){
    let p=parts(new Date(value));
    if(!Number.isFinite(p.year))throw new Error('Invalid date.');
    if(!isBusiness(p)||p.hour>=17){
      do{p=next(p);}while(!isBusiness(p));
      p={...p,hour:9,minute:0,second:0};
    }else if(p.hour<9)p={...p,hour:9,minute:0,second:0};
    return instant(p);
  }
  function dueAt(value=new Date()){
    let p=parts(startsAt(value));
    for(let days=0;days<2;){p=next(p);if(isBusiness(p))days++;}
    return instant(p);
  }
  function display(value){return new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value));}
  return {zone,startsAt,dueAt,display,instant,parts};
});
