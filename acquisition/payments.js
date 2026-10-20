const {enqueue}=require('./fulfillment');
// The database claim, conversion and fulfillment jobs are committed together. Duplicate webhooks
// cannot count twice or start a second generation. No browser event is revenue.
async function claimPayment(pool, session, options={}) {
  if (typeof options.expectedLive === 'boolean' && session.livemode !== options.expectedLive) return null;
  if (session.mode !== 'payment' || session.payment_status !== 'paid' || session.currency !== 'usd' || session.amount_total !== 45000 || !session.metadata?.submissionId) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claimed = await client.query(`UPDATE submissions SET status='generating', paid_at=now(),stripe_session_id=$2
      WHERE id=$1 AND status='pending_payment' AND (stripe_session_id=$2 OR (stripe_session_id IS NULL AND lower(contact_email)=lower($3))) AND COALESCE(is_comp,false)=false RETURNING *`,
      [session.metadata.submissionId, session.id, session.customer_details?.email || session.customer_email || '']);
    const submission = claimed.rows[0];
    if (submission) {
      await enqueue(client,submission.id);
      await client.query(`INSERT INTO acquisition_events (lead_id,submission_id,event,external_id,amount_cents,currency,live)
        VALUES ((SELECT lead_id FROM acquisition_events WHERE submission_id=$1 AND event='checkout_created' LIMIT 1),$1,'purchase',$2,45000,'usd',$3)
        ON CONFLICT (external_id) DO NOTHING`, [submission.id, session.id, session.livemode === true]);
      await client.query(`UPDATE acquisition_leads SET status='paid',follow_up_at=NULL WHERE id IN
        (SELECT lead_id FROM acquisition_events WHERE external_id=$1)`, [session.id]);
    }
    await client.query('COMMIT');
    return submission || null;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
module.exports = {claimPayment};
