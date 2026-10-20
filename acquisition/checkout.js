const {randomUUID}=require('node:crypto');
const acquisition=require('./routes');
const service=require('../marketing/service');
const {validate}=require('./intake');
const {acceptingOrders}=require('./availability');
const promos=require('./promos');

// Enhanced intake retains answers after server validation errors.
// Plain HTML form posts retain a working redirect fallback.
function checkoutError(req,res,status,message) {
  return req.get('Accept')?.includes('application/json')
    ? res.status(status).json({error:message})
    : res.status(status).send(message);
}
function checkoutRedirect(req,res,target) {
  return req.get('Accept')?.includes('application/json')
    ? res.json({redirect:target})
    : res.redirect(303,target);
}

function createCheckoutHandler(dependencies) {
  const {pool,createSubmission,updateSubmission,stripe,claimPromo=promos.claimPromo}=dependencies;
  const handler=async(req,res)=>{

  if(!acceptingOrders())return checkoutError(req,res,503,'Online orders are temporarily unavailable. Your answers remain on this page. Save a draft or request a grant-fit review at /fit. No order or payment has been created.');

  const id = randomUUID();
  let rawBody;
  try { rawBody = validate(req.body); }
  catch (error) { return checkoutError(req,res,400,error.message); }

  // Extract promo code before building the submission record.
  // promo_code and promo_valid are form-only fields — neither is a DB column.
  const promoCode = rawBody.promo_code ? rawBody.promo_code.toUpperCase() : null;
  delete rawBody.promo_code;
  delete rawBody.promo_valid;

  const submission = {
    id,
    submitted_at: new Date().toISOString(),
    status: 'pending_payment',
    ...rawBody,
  };



  try {
    await createSubmission(submission);
    await pool.query('INSERT INTO purchase_scope_acknowledgments(submission_id,policy_version) VALUES($1,$2)',[id,'2026-10-19-revisions-business-days']);
  } catch (err) {
    console.error('Failed to save submission:', err.message);
    return checkoutError(req,res,500,'Submission could not be saved. Please try again or contact hello@wellspringgrants.com.');
  }

  // ── Promo code path ────────────────────────────────────────────────────────
  // Validate independently of anything the frontend sent — the backend is
  // the only authority on whether a code is valid.
  if (promoCode) {
    const comp=await claimPromo(pool,id,promoCode);
    if(comp){
      console.log('Complimentary submission queued:',id);
      return checkoutRedirect(req,res,'/confirmation.html');
    }

    // Code was submitted but is invalid/expired/already used — fall through to Stripe
    console.log('Promo code not applied; standard checkout applies.');
  }

  // ── Stripe path (no code, or invalid code) ─────────────────────────────────
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: service.currency,
          product_data: {
            name: 'Grant Application — Single',
            description: `${submission.org_name} · ${submission.funder_name}`,
          },
          unit_amount: service.amountCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: submission.contact_email,
      metadata: { submissionId: id },
      success_url: `${process.env.APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.APP_URL}/payment-cancelled`,
    });

    await updateSubmission(id, {stripe_session_id:session.id});
    await acquisition.recordCheckout(pool,req,id,session.id);
    checkoutRedirect(req,res,session.url);
  } catch (err) {
    console.error('Stripe error:', err.message);
    checkoutError(req,res,500,'Payment setup failed. Please try again or contact hello@wellspringgrants.com.');
  }
  };
  return (req,res)=>Promise.resolve(handler(req,res)).catch(()=>checkoutError(req,res,503,'Checkout could not be prepared. Your answers remain on this page. Please try again or contact hello@wellspringgrants.com.'));
}
module.exports={createCheckoutHandler};
