// Emits the public runtime config to the browser as JS:
//   window.ENV = { PAYSTACK_PUBLIC_KEY, MODE, PRICE_GHS }
// The active public key + price come from admin-managed settings (Edge Config)
// and Vercel env vars. Secret keys are never exposed here.
var S = require("./_settings");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  var s = await S.readSettings();
  var key = S.publicKey(s.mode);
  var body =
    "window.ENV = { PAYSTACK_PUBLIC_KEY: " + JSON.stringify(key) +
    ", MODE: " + JSON.stringify(s.mode) +
    ", PRICE_GHS: " + JSON.stringify(s.priceGHS) + " };";
  res.status(200).send(body);
};
