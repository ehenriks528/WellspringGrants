const {randomUUID}=require('node:crypto');
const acquisition=require('./routes');
const service=require('../marketing/service');
const {validate}=require('./intake');

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
  const {pool,createSubmission,updateSubmission,validatePromoCode,redeemPromoCode,stripe,generateGrant,sendConfirmationEmail,sendAdminNotificationEmail}=dependencies;
  const handler=async(req,res)=>{

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
    const promoRecord = await validatePromoCode(promoCode);

    if (promoRecord) {
      // One promo use per email address — check if this email has already used any promo code
      const priorUse = await pool.query(
        'SELECT COUNT(*) FROM submissions WHERE contact_email = $1 AND promo_code_used IS NOT NULL',
        [submission.contact_email]
      );
      const alreadyUsed = parseInt(priorUse.rows[0].count, 10) > 0;

      if (alreadyUsed) {
        // Silently fall through to Stripe — no error shown to client
        console.log('Promo code blocked for repeat use; standard checkout applies.');
      } else {
      // Redeem the code and mark the submission as a comp
      await redeemPromoCode(promoCode);
      await updateSubmission(id, {
        status:          'generating',
        is_comp:         true,
        promo_code_used: promoCode,
        paid_at:         new Date().toISOString(),
      });

      // Fire generation and email — identical to the paid webhook path
      generateGrant(id).catch(err => {
        console.error('Generation failed (comp):', id, err.message);
      });

      sendConfirmationEmail(submission).catch(err => {
        console.error('Confirmation email failed (comp):', id, err.message);
      });

      sendAdminNotificationEmail(submission).catch(err => {
        console.error('Admin notification failed (comp):', id, err.message);
      });

      console.log('Complimentary submission processed:',id);
      return checkoutRedirect(req,res,'/confirmation.html');
      } // end !alreadyUsed
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
