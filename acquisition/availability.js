// Production orders require an explicit launch decision and live payment mode.
// Keep this off while payment, email or fulfillment configuration is incomplete.
function acceptingOrders(env=process.env) {
  const production=env.NODE_ENV==='production'||env.RAILWAY_ENVIRONMENT_NAME==='production';
  if(env.PAID_ORDERS_ENABLED==='false')return false;
  return !production||(env.PAID_ORDERS_ENABLED==='true'&&/^sk_live_/.test(env.STRIPE_SECRET_KEY||''));
}
function register(app) {
  app.get('/api/order-availability',(req,res)=>{
    res.set('Cache-Control','no-store');
    res.json({acceptingOrders:acceptingOrders()});
  });
}
module.exports={acceptingOrders,register};
