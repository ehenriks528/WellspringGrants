const { Resend } = require('resend');
async function acknowledge(pool, id, resend = new Resend(process.env.RESEND_API_KEY)) {
  const result = await pool.query(`UPDATE acquisition_leads SET acknowledgement_status='sending',acknowledgement_attempts=acknowledgement_attempts+1,acknowledgement_attempted_at=now()
    WHERE id=$1 AND (acknowledgement_status IN ('pending','failed') OR (acknowledgement_status='sending' AND acknowledgement_attempted_at<now()-interval '10 minutes'))
    AND created_at>now()-interval '23 hours' RETURNING *`, [id]);
  const lead = result.rows[0];
  if (!lead) return;
  try {
    const response = await resend.emails.send({
      from:'Wellspring Grants <hello@wellspringgrants.com>', replyTo:'hello@wellspringgrants.com', to:lead.email,
      subject:'We received your grant fit inquiry',
      text:`Hi ${lead.contact_name},\n\nWe received your inquiry for ${lead.org_name}. We will review the project and grant details you provided and reply about fit. This is an acknowledgment, not an eligibility decision or a purchase.\n\nIf we agree the application is a fit, the writing service is $450 with human review, delivered as Word or Google Doc. The 48-hour turnaround begins after payment and complete intake. Your nonprofit submits the application. Funding is never guaranteed. We do not support federal grants.\n\nYou can reply with the funder's guidelines if you have them. Please do not email beneficiary records, passwords, or banking details.\n\nWellspring Grants\nhello@wellspringgrants.com`
    }, {idempotencyKey:`fit-ack/${id}`});
    if (response.error || !response.data?.id) throw new Error('Email provider did not accept acknowledgment');
    await pool.query(`UPDATE acquisition_leads SET acknowledgement_status='accepted',acknowledgement_id=$2 WHERE id=$1`, [id,response.data.id]);
  } catch (error) {
    await pool.query(`UPDATE acquisition_leads SET acknowledgement_status='failed' WHERE id=$1`, [id]);
    throw error;
  }
}
function startAcknowledgmentWorker(pool) {
  let busy=false;
  const timer=setInterval(async()=>{
    if(busy)return;busy=true;
    try {
      const pending=await pool.query(`SELECT id FROM acquisition_leads WHERE created_at>now()-interval '23 hours'
        AND acknowledgement_attempts<5 AND acknowledgement_status IN ('pending','failed','sending')
        AND (acknowledgement_attempted_at IS NULL OR acknowledgement_attempted_at<now()-interval '10 minutes') LIMIT 10`);
      for(const row of pending.rows)try{await acknowledge(pool,row.id);}catch{console.error('Inquiry acknowledgment retry failed:',row.id);}
    }catch{console.error('Inquiry acknowledgment worker unavailable.');}finally{busy=false;}
  },60000);
  timer.unref();return timer;
}
module.exports = {acknowledge,startAcknowledgmentWorker};
