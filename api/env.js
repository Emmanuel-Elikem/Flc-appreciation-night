// Serves the public runtime config to the browser.
// The Paystack PUBLIC key is read from a Vercel Environment Variable
// (PAYSTACK_PUBLIC_KEY) so it is never committed to source. Switch
// test -> live by updating that env var in the Vercel dashboard — no
// code change required. The Paystack SECRET key must never be exposed
// here or anywhere client-facing.
module.exports = function handler(req, res) {
  var key = process.env.PAYSTACK_PUBLIC_KEY || "";
  var body = "window.ENV = { PAYSTACK_PUBLIC_KEY: " + JSON.stringify(key) + " };";
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).send(body);
};
