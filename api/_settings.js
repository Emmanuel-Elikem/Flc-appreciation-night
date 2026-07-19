// Shared helpers for reading/writing admin-managed settings in Edge Config,
// and for selecting the active Paystack keys based on test/live mode.
// Secret keys and the Vercel API token are only ever read here, server-side.

var DEFAULTS = { priceGHS: 150, mode: "test" };

function normalize(v) {
  v = v || {};
  var price = Number(v.priceGHS);
  return {
    priceGHS: isFinite(price) && price > 0 ? price : DEFAULTS.priceGHS,
    mode: v.mode === "live" ? "live" : "test"
  };
}

async function readSettings() {
  var id = process.env.EDGE_CONFIG_ID;
  var tok = process.env.EDGE_CONFIG_READ_TOKEN;
  if (!id || !tok) return Object.assign({}, DEFAULTS);
  try {
    var r = await fetch(
      "https://edge-config.vercel.com/" + id + "/item/settings?token=" + tok,
      { cache: "no-store" }
    );
    if (!r.ok) return Object.assign({}, DEFAULTS);
    return normalize(await r.json());
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}

async function writeSettings(next) {
  var id = process.env.EDGE_CONFIG_ID;
  var tok = process.env.VERCEL_API_TOKEN;
  var team = process.env.VERCEL_TEAM_ID;
  var value = normalize(next);
  if (!id || !tok) return { ok: false, reason: "store_unconfigured" };
  var url = "https://api.vercel.com/v1/edge-config/" + id + "/items" + (team ? "?teamId=" + team : "");
  try {
    var r = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ operation: "upsert", key: "settings", value: value }] })
    });
    if (!r.ok) return { ok: false, reason: "write_failed", status: r.status };
    return { ok: true, settings: value };
  } catch (e) {
    return { ok: false, reason: "error" };
  }
}

function publicKey(mode) {
  return mode === "live"
    ? (process.env.PAYSTACK_PUBLIC_KEY_LIVE || "")
    : (process.env.PAYSTACK_PUBLIC_KEY_TEST || process.env.PAYSTACK_PUBLIC_KEY || "");
}

function secretKey(mode) {
  return mode === "live"
    ? (process.env.PAYSTACK_SECRET_KEY_LIVE || "")
    : (process.env.PAYSTACK_SECRET_KEY_TEST || process.env.PAYSTACK_SECRET_KEY || "");
}

module.exports = { DEFAULTS: DEFAULTS, normalize: normalize, readSettings: readSettings, writeSettings: writeSettings, publicKey: publicKey, secretKey: secretKey };
