// Synced guest list — no longer writes tickets into Edge Config (Hobby 8KB cap).
//
// Sources (merged):
//   1. data/tickets-seed.json  — tickets sold before the size limit
//   2. Paystack successful transactions — every new payment (live/test by mode)
//   3. Edge Config key "deleted" — refs/ids soft-deleted from admin
//   4. Edge Config key "present" — refs/ids marked checked-in at the door
//
// GET    /api/tickets?passcode=...
// POST   /api/tickets  { id }                         → ticket page noop
// POST   /api/tickets  { passcode, action:"setPresent", id, ref, present }
// DELETE /api/tickets?id=...&passcode=...

var S = require("./_settings");
var fs = require("fs");
var path = require("path");

var ADMIN = process.env.ADMIN_PASSCODE;
var EC_ID = process.env.EDGE_CONFIG_ID;
var EC_RTOK = process.env.EDGE_CONFIG_READ_TOKEN;
var V_TOK = process.env.VERCEL_API_TOKEN;
var V_TEAM = process.env.VERCEL_TEAM_ID;

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body) {
      if (typeof req.body === "string") {
        try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve({}); }
      }
      return resolve(req.body);
    }
    var data = "";
    req.on("data", function (c) { data += c; });
    req.on("end", function () {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
    });
    req.on("error", function () { resolve({}); });
  });
}

function loadSeed() {
  try {
    var p = path.join(process.cwd(), "data", "tickets-seed.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8")) || [];
  } catch (e) {}
  return [];
}

async function readList(key) {
  if (!EC_ID || !EC_RTOK) return [];
  try {
    var r = await fetch(
      "https://edge-config.vercel.com/" + EC_ID + "/item/" + key + "?token=" + EC_RTOK,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    var v = await r.json();
    return Array.isArray(v) ? v.map(String) : [];
  } catch (e) {
    return [];
  }
}

async function writeList(key, list) {
  if (!EC_ID || !V_TOK) return { ok: false, reason: "store_unconfigured" };
  var url =
    "https://api.vercel.com/v1/edge-config/" +
    EC_ID +
    "/items" +
    (V_TEAM ? "?teamId=" + V_TEAM : "");
  try {
    var r = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + V_TOK,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [{ operation: "upsert", key: key, value: list }]
      })
    });
    return r.ok ? { ok: true } : { ok: false, reason: "write_failed", status: r.status };
  } catch (e) {
    return { ok: false, reason: "error" };
  }
}

function field(meta, name) {
  var cf = (meta && meta.custom_fields) || [];
  for (var i = 0; i < cf.length; i++) {
    if (cf[i] && cf[i].variable_name === name && cf[i].value != null) return String(cf[i].value);
  }
  return "";
}

function idFromRef(ref) {
  var s = String(ref || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (s.length >= 5) return "AN26-" + s.slice(-5);
  return "AN26-" + (s + "XXXXX").slice(0, 5);
}

async function fetchPaystackTickets(mode) {
  var secret = S.secretKey(mode);
  if (!secret) return [];
  var out = [];
  var page = 1;
  try {
    while (page <= 5) {
      var r = await fetch(
        "https://api.paystack.co/transaction?status=success&perPage=100&page=" + page,
        { headers: { Authorization: "Bearer " + secret }, cache: "no-store" }
      );
      var j = await r.json();
      if (!j || !j.status || !Array.isArray(j.data)) break;
      for (var i = 0; i < j.data.length; i++) {
        var d = j.data[i];
        if (!d || d.status !== "success") continue;
        var meta = d.metadata || {};
        var name = field(meta, "full_name") || (d.customer && (d.customer.first_name || "")) || "Guest";
        var ticketId = field(meta, "ticket_id") || idFromRef(d.reference);
        var ticketPrice = Number(field(meta, "ticket_price"));
        var amount =
          isFinite(ticketPrice) && ticketPrice > 0
            ? ticketPrice
            : typeof d.amount === "number"
              ? d.amount / 100
              : 0;
        out.push({
          id: ticketId,
          no: 0,
          name: name,
          email: (d.customer && d.customer.email) || "",
          ref: d.reference,
          amount: amount,
          currency: d.currency || "GHS",
          demo: false,
          ts: d.paid_at || d.paidAt || d.created_at || new Date().toISOString(),
          source: "paystack"
        });
      }
      if (j.data.length < 100) break;
      page++;
    }
  } catch (e) {}
  return out;
}

function mergeTickets(seed, paystack, deleted, present) {
  var del = {};
  for (var i = 0; i < deleted.length; i++) del[String(deleted[i])] = true;
  var presentSet = {};
  for (var p = 0; p < present.length; p++) presentSet[String(present[p])] = true;
  var byKey = {};

  function add(t) {
    if (!t) return;
    var ref = t.ref || "";
    var id = t.id || "";
    if (del[ref] || del[id]) return;
    var key = ref || id;
    if (!key) return;
    var prev = byKey[key];
    if (!prev) {
      byKey[key] = t;
      return;
    }
    if ((prev.source === "paystack") && t.source !== "paystack") {
      byKey[key] = Object.assign({}, prev, t, { ref: prev.ref || t.ref, id: t.id || prev.id });
    } else if (!prev.name || prev.name === "Guest") {
      byKey[key] = Object.assign({}, prev, { name: t.name || prev.name, email: t.email || prev.email });
    }
  }

  for (var s = 0; s < seed.length; s++) add(Object.assign({}, seed[s], { source: "seed" }));
  for (var q = 0; q < paystack.length; q++) add(paystack[q]);

  var list = Object.keys(byKey).map(function (k) {
    var t = byKey[k];
    t.present = !!(presentSet[t.ref] || presentSet[t.id]);
    return t;
  });
  list.sort(function (a, b) {
    return (b.ts || "") < (a.ts || "") ? -1 : 1;
  });
  for (var n = 0; n < list.length; n++) list[n].no = list.length - n;
  return list;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  var url = new URL(req.url, "http://localhost");

  if (req.method === "GET") {
    var passcode = url.searchParams.get("passcode") || "";
    if (!ADMIN || passcode !== ADMIN) {
      return res.status(401).json({ ok: false, reason: "unauthorized" });
    }
    var settings = await S.readSettings();
    var seed = loadSeed();
    var paystack = await fetchPaystackTickets(settings.mode);
    var deleted = await readList("deleted");
    var present = await readList("present");
    var tickets = mergeTickets(seed, paystack, deleted, present);
    var inCount = tickets.filter(function (t) { return t.present; }).length;
    return res.status(200).json({
      ok: true,
      tickets: tickets,
      count: tickets.length,
      presentCount: inCount,
      notPresentCount: tickets.length - inCount,
      sources: { seed: seed.length, paystack: paystack.length, deleted: deleted.length, present: present.length }
    });
  }

  if (req.method === "POST") {
    var body = await readBody(req);

    // Door check-in / undo
    if (body && body.action === "setPresent") {
      if (!ADMIN || body.passcode !== ADMIN) {
        return res.status(401).json({ ok: false, reason: "unauthorized" });
      }
      var id = String(body.id || "");
      var ref = String(body.ref || "");
      if (!id && !ref) return res.status(400).json({ ok: false, reason: "missing_id" });

      var present = await readList("present");
      var keys = [id, ref].filter(Boolean);
      var want = !!body.present;

      if (want) {
        for (var i = 0; i < keys.length; i++) {
          if (present.indexOf(keys[i]) === -1) present.push(keys[i]);
        }
      } else {
        present = present.filter(function (k) { return keys.indexOf(k) === -1; });
      }
      if (present.length > 800) present = present.slice(-800);

      var result = await writeList("present", present);
      if (!result.ok) return res.status(500).json(result);
      return res.status(200).json({ ok: true, present: want, presentCount: present.length });
    }

    // Ticket page sync (noop — Paystack is source of truth)
    if (!body || !body.id) {
      return res.status(400).json({ ok: false, reason: "invalid_ticket" });
    }
    return res.status(200).json({ ok: true, stored: "paystack" });
  }

  if (req.method === "DELETE") {
    var pass = url.searchParams.get("passcode") || "";
    var delId = url.searchParams.get("id") || "";
    if (!ADMIN || pass !== ADMIN) {
      return res.status(401).json({ ok: false, reason: "unauthorized" });
    }
    if (!delId) return res.status(400).json({ ok: false, reason: "missing_id" });

    var deleted = await readList("deleted");
    if (deleted.indexOf(delId) === -1) deleted.push(delId);
    var delRef = url.searchParams.get("ref") || "";
    if (delRef && deleted.indexOf(delRef) === -1) deleted.push(delRef);
    if (deleted.length > 400) deleted = deleted.slice(-400);
    var delResult = await writeList("deleted", deleted);
    return res.status(delResult.ok ? 200 : 500).json(delResult);
  }

  return res.status(405).json({ ok: false, reason: "method_not_allowed" });
};
