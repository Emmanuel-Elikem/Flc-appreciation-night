// Synced ticket store backed by Vercel Edge Config.
//
// GET  /api/tickets?passcode=...          → list all tickets (passcode required)
// POST /api/tickets                       → save / upsert a ticket (no auth — caller must
//                                           send a real ticket object; demo flag is preserved)
// DELETE /api/tickets?id=...&passcode=... → delete one ticket by ticket id (passcode required)

var S = require("./_settings");

var EC_ID   = process.env.EDGE_CONFIG_ID;
var EC_RTOK = process.env.EDGE_CONFIG_READ_TOKEN;
var V_TOK   = process.env.VERCEL_API_TOKEN;
var V_TEAM  = process.env.VERCEL_TEAM_ID;
var ADMIN   = process.env.ADMIN_PASSCODE;

// Edge Config key for a ticket id like "AN26-ABCDE" → "tk_AN26_ABCDE"
function ecKey(id) {
  return "tk_" + String(id).replace(/[^a-zA-Z0-9]/g, "_");
}

async function listTickets() {
  if (!EC_ID || !EC_RTOK) return [];
  try {
    var r = await fetch(
      "https://edge-config.vercel.com/" + EC_ID + "/items?token=" + EC_RTOK,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    var data = await r.json();
    // Response is an object: { settings: {...}, tk_AN26_ABCDE: {...}, ... }
    var tickets = [];
    for (var key in data) {
      if (key.startsWith("tk_")) tickets.push(data[key]);
    }
    // Sort newest first by ts
    tickets.sort(function (a, b) {
      return (b.ts || "") < (a.ts || "") ? -1 : 1;
    });
    return tickets;
  } catch (e) {
    return [];
  }
}

async function upsertTicket(ticket) {
  if (!EC_ID || !V_TOK) return { ok: false, reason: "store_unconfigured" };
  var key = ecKey(ticket.id);
  var url = "https://api.vercel.com/v1/edge-config/" + EC_ID + "/items" +
    (V_TEAM ? "?teamId=" + V_TEAM : "");
  try {
    var r = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + V_TOK, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ operation: "upsert", key: key, value: ticket }] })
    });
    return r.ok ? { ok: true } : { ok: false, reason: "write_failed", status: r.status };
  } catch (e) {
    return { ok: false, reason: "error" };
  }
}

async function deleteTicket(id) {
  if (!EC_ID || !V_TOK) return { ok: false, reason: "store_unconfigured" };
  var key = ecKey(id);
  var url = "https://api.vercel.com/v1/edge-config/" + EC_ID + "/items" +
    (V_TEAM ? "?teamId=" + V_TEAM : "");
  try {
    var r = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + V_TOK, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ operation: "delete", key: key }] })
    });
    return r.ok ? { ok: true } : { ok: false, reason: "write_failed" };
  } catch (e) {
    return { ok: false, reason: "error" };
  }
}

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

function validateTicket(t) {
  // Must have at minimum an id, name, and ts
  return t && typeof t.id === "string" && t.id.startsWith("AN26-") &&
    typeof t.name === "string" && t.name.length >= 1;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  var url = new URL(req.url, "http://localhost");

  // ── GET: list all tickets (passcode required) ──────────────────────
  if (req.method === "GET") {
    var passcode = url.searchParams.get("passcode") || "";
    if (!ADMIN || passcode !== ADMIN) {
      return res.status(401).json({ ok: false, reason: "unauthorized" });
    }
    var tickets = await listTickets();
    return res.status(200).json({ ok: true, tickets: tickets, count: tickets.length });
  }

  // ── POST: save / upsert a ticket ───────────────────────────────────
  if (req.method === "POST") {
    var body = await readBody(req);
    if (!validateTicket(body)) {
      return res.status(400).json({ ok: false, reason: "invalid_ticket" });
    }
    // Sanitise: only store known fields
    var ticket = {
      id:       String(body.id),
      no:       Number(body.no) || 0,
      name:     String(body.name).slice(0, 120),
      email:    String(body.email || "").slice(0, 200),
      ref:      String(body.ref || ""),
      amount:   Number(body.amount) || 0,
      currency: String(body.currency || "GHS"),
      demo:     !!body.demo,
      ts:       String(body.ts || new Date().toISOString())
    };
    var result = await upsertTicket(ticket);
    return res.status(result.ok ? 200 : 500).json(result);
  }

  // ── DELETE: remove a ticket by id (passcode required) ─────────────
  if (req.method === "DELETE") {
    var passcode = url.searchParams.get("passcode") || "";
    var id = url.searchParams.get("id") || "";
    if (!ADMIN || passcode !== ADMIN) {
      return res.status(401).json({ ok: false, reason: "unauthorized" });
    }
    if (!id) return res.status(400).json({ ok: false, reason: "missing_id" });
    var result = await deleteTicket(id);
    return res.status(result.ok ? 200 : 500).json(result);
  }

  return res.status(405).json({ ok: false, reason: "method_not_allowed" });
};
