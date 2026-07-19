// Passcode-protected admin endpoint for managing settings.
// The passcode is checked against the ADMIN_PASSCODE env var (server-side).
// Actions:
//   { passcode, action: "getSettings" }
//   { passcode, action: "saveSettings", priceGHS, mode }
var S = require("./_settings");

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body) {
      if (typeof req.body === "string") { try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve({}); } }
      return resolve(req.body);
    }
    var data = "";
    req.on("data", function (c) { data += c; });
    req.on("end", function () { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
    req.on("error", function () { resolve({}); });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, reason: "method_not_allowed" });
  }

  var body = await readBody(req);
  var expected = process.env.ADMIN_PASSCODE || "";

  if (!expected || !body.passcode || body.passcode !== expected) {
    return res.status(401).json({ ok: false, reason: "unauthorized" });
  }

  var action = body.action;

  if (action === "getSettings") {
    var s = await S.readSettings();
    return res.status(200).json({ ok: true, settings: s });
  }

  if (action === "saveSettings") {
    var next = S.normalize({ priceGHS: body.priceGHS, mode: body.mode });
    var result = await S.writeSettings(next);
    if (!result.ok) return res.status(200).json({ ok: false, reason: result.reason || "write_failed" });
    return res.status(200).json({ ok: true, settings: result.settings });
  }

  return res.status(400).json({ ok: false, reason: "unknown_action" });
};
