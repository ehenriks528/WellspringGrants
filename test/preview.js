// Isolated review preview: in-memory PostgreSQL, no paid APIs, no email sends.
const express=require('express');const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs');const path=require('node:path');
const {register}=require('../acquisition/routes');
async function main(){
 const db=new PGlite();await db.exec(fs.readFileSync(path.join(__dirname,'../acquisition/schema.sql'),'utf8'));
 let tail=Promise.resolve();const query=async(sql,values)=>{const result=await db.query(sql,values);return {...result,rowCount:result.rowCount??result.affectedRows??result.rows.length};};
 const pool={query,connect:async()=>{let release;const previous=tail;tail=new Promise(resolve=>release=resolve);await previous;return {query,release};}};
 process.env.APP_URL='http://127.0.0.1:4317';process.env.ADMIN_PASSWORD='preview-only-not-a-real-secret';
 const app=express();app.use(express.json());app.use(express.urlencoded({extended:false}));app.use(express.static(path.join(__dirname,'../public')));
 app.use('/admin',(req,res,next)=>{req.auth={user:'local-preview'};res.set('Cache-Control','no-store');next();});
 app.get('/admin/leads.js',(req,res)=>res.sendFile(path.join(__dirname,'../public-admin/leads.js')));
 register(app,pool,async(pool,id)=>pool.query("UPDATE acquisition_leads SET acknowledgement_status='preview_no_send' WHERE id=$1",[id]));
 app.use((error,req,res,next)=>{console.error(error.message);res.status(500).json({error:'Preview request failed.'});});
 app.listen(4317,'127.0.0.1',()=>console.log('Isolated preview: http://127.0.0.1:4317/fit — no email or payment connections.'));
}
main().catch(error=>{console.error(error);process.exit(1);});
