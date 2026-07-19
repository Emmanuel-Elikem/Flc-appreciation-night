(function () {
  "use strict";
  var C = window.EVENT_CONFIG;
  var STORE_KEY = "an26_purchases";
  var SESSION_KEY = "an26_admin_ok";
  var PASS_KEY = "an26_admin_pass";
  var gate = document.getElementById("gate");
  var dash = document.getElementById("dash");
  var gateError = document.getElementById("gateError");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>\"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function readList() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch (e) { return []; } }
  function writeList(l) { try { localStorage.setItem(STORE_KEY, JSON.stringify(l)); } catch (e) {} }
  function fmtDate(iso) { try { return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return iso || ""; } }
  function currentPass() { try { return sessionStorage.getItem(PASS_KEY) || ""; } catch (e) { return ""; } }

  function render() {
    var list = readList().slice().reverse();
    document.getElementById("statCount").textContent = list.length;
    var revenue = list.reduce(function (sum, r) { return sum + (Number(r.amount) || 0); }, 0);
    document.getElementById("statRevenue").textContent = C.currency + " " + revenue;
    document.getElementById("statPrice").textContent = C.currency + " " + C.priceGHS;
    document.getElementById("rows").innerHTML = list.map(function (r) {
      var key = esc(r.ref || r.id || "");
      var ts = esc(r.ts || "");
      return "<tr>" +
        "<td>" + esc(r.name) + "</td>" +
        "<td>" + esc(r.email) + "</td>" +
        "<td><code>" + esc(r.id) + "</code></td>" +
        "<td><code>" + esc(r.ref) + "</code></td>" +
        "<td>" + esc(fmtDate(r.ts)) + "</td>" +
        "<td>" + (r.demo ? '<span class="tag">Test</span>' : "") + "</td>" +
        "<td><button type=\"button\" class=\"row-del\" data-ref=\"" + key + "\" data-ts=\"" + ts + "\" aria-label=\"Delete ticket\">Delete</button></td>" +
        "</tr>";
    }).join("");
    document.getElementById("emptyState").hidden = list.length > 0;
  }

  function deleteTicket(ref, ts) {
    var list = readList();
    var out = list.filter(function (r) {
      var k = r.ref || r.id || "";
      return !(k === ref && (r.ts || "") === ts);
    });
    writeList(out);
    render();
  }

  // ---- Settings (price + test/live mode) ----
  var priceInput = document.getElementById("priceInput");
  var modePill = document.getElementById("modePill");
  var statusEl = document.getElementById("settingsStatus");
  var selectedMode = "test";

  function setMode(mode) {
    selectedMode = mode === "live" ? "live" : "test";
    var btns = document.querySelectorAll(".mode-btn");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("is-active", btns[i].getAttribute("data-mode") === selectedMode);
    }
    modePill.textContent = selectedMode === "live" ? "Live mode" : "Test mode";
    modePill.setAttribute("data-mode", selectedMode);
  }

  function loadSettings() {
    statusEl.textContent = "";
    fetch("/api/settings", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s && s.priceGHS != null) priceInput.value = s.priceGHS;
        setMode(s && s.mode === "live" ? "live" : "test");
      })
      .catch(function () { setMode("test"); });
  }

  function saveSettings() {
    var btn = document.getElementById("saveSettingsBtn");
    var price = Number(priceInput.value);
    if (!isFinite(price) || price <= 0) {
      statusEl.className = "settings-status err";
      statusEl.textContent = "Enter a valid price.";
      return;
    }
    if (selectedMode === "live") {
      if (!window.confirm("Switch to LIVE mode? Real cards will be charged for every ticket.")) return;
    }
    btn.disabled = true;
    statusEl.className = "settings-status";
    statusEl.textContent = "Saving\u2026";
    fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: currentPass(), action: "saveSettings", priceGHS: price, mode: selectedMode })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          setMode(res.settings.mode);
          priceInput.value = res.settings.priceGHS;
          statusEl.className = "settings-status ok";
          statusEl.textContent = "Saved. Live for everyone now.";
        } else {
          statusEl.className = "settings-status err";
          statusEl.textContent = res && res.reason === "unauthorized" ? "Session expired \u2014 sign in again." : "Couldn\u2019t save. Try again.";
        }
      })
      .catch(function () {
        statusEl.className = "settings-status err";
        statusEl.textContent = "Network error. Try again.";
      })
      .finally(function () { btn.disabled = false; });
  }

  function open() {
    gate.hidden = true;
    dash.hidden = false;
    render();
    loadSettings();
  }

  gate.addEventListener("submit", function (e) {
    e.preventDefault();
    var val = document.getElementById("passcode").value;
    var submitBtn = gate.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; }
    gateError.classList.remove("show");
    // Authenticate against the server (passcode lives only in ADMIN_PASSCODE env var).
    fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: val, action: "getSettings" })
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.body && res.body.ok) {
          try { sessionStorage.setItem(SESSION_KEY, "1"); sessionStorage.setItem(PASS_KEY, val); } catch (err) {}
          open();
        } else {
          gateError.classList.add("show");
        }
      })
      .catch(function () { gateError.classList.add("show"); })
      .finally(function () { if (submitBtn) { submitBtn.disabled = false; } });
  });

  try { if (sessionStorage.getItem(SESSION_KEY) === "1") open(); } catch (e) {}

  document.getElementById("signOutBtn").addEventListener("click", function () {
    try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(PASS_KEY); } catch (e) {}
    dash.hidden = true; gate.hidden = false; document.getElementById("passcode").value = "";
  });

  document.getElementById("rows").addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".row-del") : null;
    if (!btn) return;
    if (window.confirm("Delete this ticket from the guest list? This can\u2019t be undone.")) {
      deleteTicket(btn.getAttribute("data-ref"), btn.getAttribute("data-ts"));
    }
  });

  document.querySelectorAll(".mode-btn").forEach(function (b) {
    b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); });
  });
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);

  document.getElementById("exportBtn").addEventListener("click", function () {
    var list = readList();
    var header = "Name,Email,Ticket ID,Reference,Amount,Currency,Test,Issued\n";
    var body = list.map(function (r) {
      return [r.name, r.email, r.id, r.ref, r.amount, r.currency, r.demo ? "yes" : "no", r.ts].map(function (v) {
        v = String(v == null ? "" : v); return /[\",\n]/.test(v) ? '"' + v.replace(/\"/g, '""') + '"' : v;
      }).join(",");
    }).join("\n");
    var blob = new Blob([header + body], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "appreciation-night-guest-list.csv"; a.click();
    URL.revokeObjectURL(a.href);
  });
})();
