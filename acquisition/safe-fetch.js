const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');
function publicIP(ip) {
  if(net.isIP(ip)===4) {
    const [a,b,c]=ip.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19||b===51))||(a===203&&b===0&&c===113));
  }
  return net.isIP(ip)===6 && /^[23]/.test(ip) && !/^2001:(db8|0:|10:|20:)/i.test(ip) && !/^2002:/i.test(ip);
}
async function fetchGuidelinesText(input, redirects=0) {
  try {
    const target=new URL(input);
    if(target.protocol!=='https:'||target.username||target.password||(target.port&&target.port!=='443')||redirects>3) return null;
    const hostname=target.hostname.replace(/^\[|\]$/g,'');
    const addresses=net.isIP(hostname)?[{address:hostname,family:net.isIP(hostname)}]:await dns.lookup(hostname,{all:true});
    if(!addresses.length||addresses.some(item=>!publicIP(item.address)))return null;
    const address=addresses[0];
    return await new Promise(resolve=>{
      const request=https.get(target,{lookup:(_host,options,callback)=>options.all?callback(null,[address]):callback(null,address.address,address.family),headers:{'User-Agent':'WellspringGrants/1.0'}},response=>{
        if([301,302,303,307,308].includes(response.statusCode)) {
          response.resume(); resolve(fetchGuidelinesText(new URL(response.headers.location,target).href,redirects+1));return;
        }
        if(response.statusCode!==200||!(response.headers['content-type']||'').includes('text/html')){response.resume();resolve(null);return;}
        let body='',size=0;
        response.on('data',chunk=>{size+=chunk.length;if(size>1024*1024){response.destroy();resolve(null);}else body+=chunk.toString('utf8');});
        response.on('end',()=>resolve(body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,12000)));
        response.on('error',()=>resolve(null));
      });
      request.setTimeout(8000,()=>{request.destroy();resolve(null);});
      request.on('error',()=>resolve(null));
    });
  }catch{return null;}
}
module.exports={fetchGuidelinesText,publicIP};
