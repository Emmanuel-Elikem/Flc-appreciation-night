// Public, read-only view of the current buyer-facing settings.
// Never returns any Paystack keys — only the price and the active mode.
var S = require("./_settings");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  var s = await S.readSettings();
  res.status(200).json({ priceGHS: s.priceGHS, mode: s.mode });
};
