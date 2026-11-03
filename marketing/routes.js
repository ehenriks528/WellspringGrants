const path = require('node:path');
const manifest = require('./manifest');
const discovery = require('./discovery');
function register(app) {
  app.get('/robots.txt',(req,res)=>res.type('text/plain').send(discovery.robots()));
  app.get('/sitemap.xml',(req,res)=>res.type('application/xml').send(discovery.sitemap(manifest)));
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
