const {enqueue}=require('./fulfillment');
// Serialize a normalized email across every promo code; update the remaining
// use counter, mark the comp and queue its work in the same transaction.
async function claimPromo(pool,id,code) {
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const found=await client.query("SELECT * FROM submissions WHERE id=$1 AND status='pending_payment' FOR UPDATE",[id]);
    const row=found.rows[0];if(!row){await client.query('ROLLBACK');return null;}
    const email=(row.contact_email||'').trim().toLowerCase();
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['promo:'+email]);
    const prior=await client.query('SELECT id FROM submissions WHERE lower(trim(contact_email))=$1 AND promo_code_used IS NOT NULL LIMIT 1',[email]);
    if(prior.rows.length){await client.query('ROLLBACK');return null;}
    const offer=(await client.query('SELECT * FROM promo_codes WHERE code=$1 FOR UPDATE',[code])).rows[0];
    if(!offer){await client.query('ROLLBACK');return null;}
    if(offer.first_application_only){
      const ein=String(row.ein||'').replace(/[^0-9]/g,'');
      const allowed=String(offer.eligible_ein||'').replace(/[^0-9]/g,'');
      // A code cannot be redeemed until its intended legal applicant is assigned.
      if(ein.length!==9||allowed.length!==9||ein!==allowed||offer.max_uses!==1){await client.query('ROLLBACK');return null;}
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['first-application:'+ein]);
      const priorOrg=await client.query(`SELECT id FROM submissions
        WHERE id<>$1 AND regexp_replace(COALESCE(ein,''),'[^0-9]','','g')=$2
        AND (paid_at IS NOT NULL OR COALESCE(is_comp,false)=true) LIMIT 1`,[id,ein]);
      if(priorOrg.rows.length){await client.query('ROLLBACK');return null;}
    }
    const claimed=await client.query(`UPDATE promo_codes SET times_used=times_used+1 WHERE code=$1
      AND is_active AND (expires_at IS NULL OR expires_at>now()) AND times_used<max_uses RETURNING code`,[code]);
    if(!claimed.rows.length){await client.query('ROLLBACK');return null;}
    const result=await client.query(`UPDATE submissions SET status='generating',is_comp=true,
      promo_code_used=$2,paid_at=now() WHERE id=$1 RETURNING *`,[id,code]);
    await enqueue(client,id);await client.query('COMMIT');return result.rows[0];
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
module.exports={claimPromo};
