// Offline preparation only: prints five inactive, unassigned slots for owner review.
// Redirect output into a private file. Never commit generated invitation codes.
// Does not connect to a database, activate a code or change existing free promises.
const {randomBytes}=require('node:crypto');
const rows=Array.from({length:5},()=>{
 const code='WG-FIRST-'+randomBytes(12).toString('hex').toUpperCase();
 return `('${code}','Five-nonprofit free first application pilot',false,1,true,NULL)`;
});
process.stdout.write('-- REVIEW ONLY. No live execution without exact approval.\n'+
 '-- Bind each slot to a verified EIN before activation; never reset uses.\n'+
 'INSERT INTO promo_codes(code,description,is_active,max_uses,first_application_only,eligible_ein)\nVALUES\n'+rows.join(',\n')+'\nON CONFLICT(code) DO NOTHING;\n');
