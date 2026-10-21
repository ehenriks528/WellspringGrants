const {escape}=require('./validation');

// Keep the normal JSON flow; native form posts must also get a useful result
// when the browser cannot load the enhancement script. Never echo form answers.
function reply(req,res,status,data){
  res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});
  if(!req.is('application/x-www-form-urlencoded'))return res.status(status).json(data);
  const saved=data.saved===true;
  const title=saved?'Inquiry saved':'Inquiry not saved';
  const message=saved?data.message:data.error;
  return res.status(status).type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="origin"><title>${title} — Wellspring Grants</title><link rel="stylesheet" href="/funnel.css"></head><body><header><a href="/">Wellspring Grants</a></header><main><div class="card"><h1>${title}.</h1><p>${escape(message)}</p>${saved?'<p>No payment was taken. This inquiry does not start the two-business-day writing turnaround or confirm service fit.</p><a class="button" href="/pricing">Review pricing and scope</a>':'<p>Use your browser’s Back button to review your details and try again, or <a href="/fit">open the fit form</a>.</p>'}<p>For help, email <a href="mailto:hello@wellspringgrants.com">hello@wellspringgrants.com</a>.</p></div></main><footer><a href="/privacy">Privacy</a></footer></body></html>`);
}

module.exports={reply};
