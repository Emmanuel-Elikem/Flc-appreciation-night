(function () {
  "use strict";
  var C = window.EVENT_CONFIG || {};
  var STORE_KEY = "an26_purchases";

  var statusBox = document.getElementById("statusBox");
  var ticketBox = document.getElementById("ticketBox");
  var errorBox = document.getElementById("errorBox");

  function qs(k) {
    try { return new URLSearchParams(window.location.search).get(k); } catch (e) { return null; }
  }
  var reference = qs("reference") || qs("trxref") || qs("ref");

  function readList() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch (e) { return []; } }
  function writeList(l) { try { localStorage.setItem(STORE_KEY, JSON.stringify(l)); } catch (e) {} }
  function findByRef(ref) {
    if (!ref) return null;
    var l = readList();
    for (var i = l.length - 1; i >= 0; i--) { if (l[i] && l[i].ref === ref) return l[i]; }
    return null;
  }
  function genId() {
    var chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", out = "";
    for (var i = 0; i < 5; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return "AN26-" + out;
  }

  // Sync a ticket record to the server (fire-and-forget; localStorage is the fallback).
  function syncToServer(rec) {
    try {
      fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rec)
      }).catch(function () {});
    } catch (e) {}
  }

  function applyConfig(root) {
    (root || document).querySelectorAll("[data-cfg]").forEach(function (el) {
      var k = el.getAttribute("data-cfg");
      if (C[k] != null) el.textContent = C[k];
    });
  }

  function makeQr(el, text, size) {
    if (!el) return;
    if (!window.qrcode) { setTimeout(function () { makeQr(el, text, size); }, 100); return; }
    try {
      var qr = window.qrcode(0, "M");
      qr.addData(text);
      qr.make();
      var count = qr.getModuleCount();
      var margin = 2;
      var total = count + margin * 2;
      var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      var scale = Math.max(1, Math.floor((size * dpr) / total));
      var px = total * scale;
      var canvas = document.createElement("canvas");
      canvas.width = px; canvas.height = px;
      canvas.style.width = size + "px"; canvas.style.height = size + "px"; canvas.style.display = "block";
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#F4EEDF"; ctx.fillRect(0, 0, px, px);
      ctx.fillStyle = "#120E08";
      for (var r = 0; r < count; r++) {
        for (var c = 0; c < count; c++) {
          if (qr.isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
        }
      }
      el.innerHTML = "";
      el.appendChild(canvas);
    } catch (e) {}
  }

  function show(box) {
    statusBox.hidden = box !== statusBox;
    ticketBox.hidden = box !== ticketBox;
    errorBox.hidden = box !== errorBox;
  }

  function showError(msg) {
    if (msg) document.getElementById("errorSub").textContent = msg;
    var support = document.getElementById("supportNote");
    if (C.supportContact) {
      support.innerHTML = "Need help? Contact <a href=\"mailto:" + C.supportContact + "\">" + C.supportContact + "</a> with your reference: " + (reference || "\u2014");
    } else if (reference) {
      support.textContent = "Your payment reference: " + reference;
    }
    show(errorBox);
  }

  var rendered = false;
  var synced = false;
  function renderTicket(rec, verified) {
    applyConfig(document);
    document.getElementById("tkName").textContent = rec.name || "Guest";
    document.getElementById("tkId").textContent = rec.id;
    document.getElementById("tkNo").textContent = "\u2116 " + String(rec.no || 1).padStart(4, "0");
    var note = document.getElementById("verifyNote");
    if (verified) {
      document.getElementById("okEyebrow").textContent = "Payment confirmed";
      note.textContent = "";
    } else {
      note.textContent = "Reference " + (rec.ref || "\u2014");
    }
    if (!rendered) {
      show(ticketBox);
      makeQr(document.getElementById("realQr"), rec.id + " \u00b7 " + rec.name, 104);
      rendered = true;
    }
    // Sync to server once we have the best version of the record (prefer verified)
    if (!synced && (verified || !rec.demo)) {
      synced = true;
      syncToServer(rec);
    }
  }

  function verify(ref) {
    return fetch("/api/verify?reference=" + encodeURIComponent(ref))
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, reason: "error" }; });
  }

  function boot() {
    if (!reference) { showError("No payment reference was provided in the link."); return; }

    var rec = findByRef(reference);
    if (rec) renderTicket(rec, false);

    verify(reference).then(function (v) {
      if (v && v.ok) {
        if (!rec) {
          var count = readList().length + 1;
          rec = {
            id: genId(), no: count,
            name: v.name || "Guest", email: v.email || "",
            ref: reference, amount: v.amount != null ? v.amount : C.priceGHS,
            currency: v.currency || C.currency, demo: false,
            ts: v.paidAt || new Date().toISOString()
          };
          var l = readList(); l.push(rec); writeList(l);
        } else {
          if (v.name) rec.name = v.name;
          if (v.email) rec.email = v.email;
          // Update in local storage
          var l = readList();
          for (var i = 0; i < l.length; i++) { if (l[i] && l[i].ref === reference) { l[i] = rec; break; } }
          writeList(l);
        }
        renderTicket(rec, true);
      } else if (rec) {
        renderTicket(rec, false);
      } else if (v && v.reason === "verification_unavailable") {
        showError("We couldn\u2019t confirm this payment on this device. If you just paid, open this page on the device you paid from \u2014 your ticket is saved there.");
      } else {
        showError("We couldn\u2019t find a ticket for reference " + reference + ".");
      }
    });
  }

  document.getElementById("downloadBtn").addEventListener("click", function () {
    var el = document.getElementById("realTicket");
    if (!window.html2canvas) return;
    var btn = this; btn.disabled = true; btn.textContent = "Preparing\u2026";
    window.html2canvas(el, { scale: 3, backgroundColor: null, useCORS: true }).then(function (canvas) {
      var a = document.createElement("a");
      a.download = "AppreciationNight-" + document.getElementById("tkId").textContent + ".png";
      a.href = canvas.toDataURL("image/png"); a.click();
    }).finally(function () { btn.disabled = false; btn.textContent = "Download ticket"; });
  });

  boot();
})();
