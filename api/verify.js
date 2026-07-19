// Verifies a Paystack transaction server-side using the SECRET key that matches
// the current mode (test/live). The secret key is read only here, never exposed
// to the browser. Falls back to "verification_unavailable" when no secret key is
// configured for the active mode (e.g. test mode without a test secret key).
var S = require("./_settings");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    var url = new URL(req.url, "http://localhost");
    var reference =
      url.searchParams.get("reference") ||
      url.searchParams.get("trxref") ||
      url.searchParams.get("ref");

    var s = await S.readSettings();
    var secret = S.secretKey(s.mode);

    if (!reference) {
      return res.status(400).json({ ok: false, reason: "missing_reference" });
    }
    if (!secret) {
      return res.status(200).json({ ok: false, reason: "verification_unavailable", mode: s.mode });
    }

    var r = await fetch(
      "https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference),
      { headers: { Authorization: "Bearer " + secret } }
    );
    var j = await r.json();

    if (!j || !j.status || !j.data) {
      return res.status(200).json({ ok: false, reason: "not_verified", message: (j && j.message) || "" });
    }

    var d = j.data;
    var fullName = "";
    var cf = (d.metadata && d.metadata.custom_fields) || [];
    for (var i = 0; i < cf.length; i++) {
      if (cf[i] && cf[i].variable_name === "full_name" && cf[i].value) fullName = cf[i].value;
    }

    return res.status(200).json({
      ok: d.status === "success",
      status: d.status,
      reference: d.reference,
      amount: typeof d.amount === "number" ? d.amount / 100 : null,
      currency: d.currency || "",
      email: (d.customer && d.customer.email) || "",
      name: fullName,
      paidAt: d.paid_at || d.paidAt || null
    });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: "error" });
  }
};
