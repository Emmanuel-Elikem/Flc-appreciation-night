// Verifies a Paystack transaction server-side using the SECRET key.
// The secret key is read from the PAYSTACK_SECRET_KEY Vercel env var and is
// never exposed to the browser. If the secret key is not set, the endpoint
// responds with reason "verification_unavailable" and the ticket page falls
// back to the record saved on the buyer's device.
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    var url = new URL(req.url, "http://localhost");
    var reference =
      url.searchParams.get("reference") ||
      url.searchParams.get("trxref") ||
      url.searchParams.get("ref");
    var secret = process.env.PAYSTACK_SECRET_KEY || "";

    if (!reference) {
      return res.status(400).json({ ok: false, reason: "missing_reference" });
    }
    if (!secret) {
      return res.status(200).json({ ok: false, reason: "verification_unavailable" });
    }

    var r = await fetch(
      "https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference),
      { headers: { Authorization: "Bearer " + secret } }
    );
    var j = await r.json();

    if (!j || !j.status || !j.data) {
      return res
        .status(200)
        .json({ ok: false, reason: "not_verified", message: (j && j.message) || "" });
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
