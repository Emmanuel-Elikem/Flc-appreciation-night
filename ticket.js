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

  function applyConfig(root) {
    (root || document).querySelectorAll("[data-cfg]").forEach(function (el) {
      var k = el.getAttribute("data-cfg");
      if (C[k] != null) el.textContent = C[k];
    });
  }

  function makeQr(el, text, size) {
    if (!el || !window.QRCode) return;
    el.innerHTML = "";
    new window.QRCode(el, { text: text, width: size, height: size, colorDark: "#120E08", colorLight: "#F4EEDF", correctLevel: window.QRCode.CorrectLevel.M });
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
      // QR needs the QRCode lib, which loads deferred
      var tryQr = function () {
        if (window.QRCode) { makeQr(document.getElementById("realQr"), rec.id + " \u00b7 " + rec.name, 104); }
        else { setTimeout(tryQr, 120); }
      };
      tryQr();
      rendered = true;
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
    // If we already have a local record, show it right away for a fast experience.
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
        }
        renderTicket(rec, true);
      } else if (rec) {
        // Couldn't confirm with the server, but we have a device record — still show it.
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
