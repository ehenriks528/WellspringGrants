const path = require('node:path');
const service = require('./service');
const manifest = require('./manifest');
function register(app) {
  app.get('/robots.txt',(req,res)=>res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: '+service.origin+'/sitemap.xml\n'));
  app.get('/sitemap.xml',(req,res)=>res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+manifest.map(p=>'<url><loc>'+service.origin+p.path+'</loc></url>').join('')+'</urlset>'));
  app.use((req,res,next)=>{
    if (/^\/(?:apply(?:\.html)?|fit(?:\.html)?|confirmation\.html|payment-success|payment-cancelled(?:\.html)?|admin(?:\/.*)?|api\/.*)$/.test(req.path)) {
      res.set('X-Robots-Tag','noindex, nofollow');
      res.set('Cache-Control','no-store');
    }
    next();
  });
  for (const page of manifest) {
    const legacy='/'+page.file;
    if (legacy!==page.path) app.get(legacy,(req,res)=>res.redirect(301,page.path));
    app.get(page.path,(req,res)=>res.sendFile(path.join(__dirname,'../public',page.file)));
  }
}
module.exports={register};
