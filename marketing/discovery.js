const service = require('./service');
const xml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
function robots() {
  return 'User-agent: *\nAllow: /\nSitemap: '+service.origin+'/sitemap.xml\n';
}
function sitemap(pages) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+pages.map(page=>'<url><loc>'+xml(service.origin+page.path)+'</loc></url>').join('')+'</urlset>';
}
module.exports={robots,sitemap};
