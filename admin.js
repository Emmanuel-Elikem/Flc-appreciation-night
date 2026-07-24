(function () {
  "use strict";
  var C = window.EVENT_CONFIG;
  var SESSION_KEY = "an26_admin_ok";
  var PASS_KEY = "an26_admin_pass";
  var STORE_KEY = "an26_purchases";
  var gate = document.getElementById("gate");
  var dash = document.getElementById("dash");
  var gateError = document.getElementById("gateError");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>\"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtDate(iso) { try { return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return iso || ""; } }
  function currentPass() { try { return sessionStorage.getItem(PASS_KEY) || ""; } catch (e) { return ""; } }

  var allTickets = [];
  var presenceFilter = "all"; // all | in | out

  function setSyncStatus(msg, cls) {
    var el = document.getElementById("syncStatus");
    el.textContent = msg;
    el.className = "admin-sync-status" + (cls ? " " + cls : "");
  }

  function fetchTickets() {
    setSyncStatus("Loading\u2026", "");
    return fetch("/api/tickets?passcode=" + encodeURIComponent(currentPass()), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) {
          setSyncStatus("Couldn\u2019t load list. Try refreshing.", "err");
          return;
        }
        allTickets = res.tickets || [];
        var ts = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        setSyncStatus("Full paid list from Paystack \u00b7 last updated " + ts, "ok");
        renderTickets();
        updateStats();
      })
      .catch(function () { setSyncStatus("Network error. Try refreshing.", "err"); });
  }

  function filteredList() {
    var query = (document.getElementById("searchInput").value || "").trim().toLowerCase();
    return allTickets.filter(function (r) {
      if (presenceFilter === "in" && !r.present) return false;
      if (presenceFilter === "out" && r.present) return false;
      if (!query) return true;
      return (r.name || "").toLowerCase().includes(query) ||
        (r.email || "").toLowerCase().includes(query) ||
        (r.id || "").toLowerCase().includes(query) ||
        (r.ref || "").toLowerCase().includes(query);
    });
  }

  function renderTickets() {
    var filtered = filteredList();
    document.getElementById("rows").innerHTML = filtered.map(function (r) {
      var present = !!r.present;
      return "<tr class=\"" + (present ? "row--in" : "") + "\">" +
        "<td>" + esc(r.name) + "</td>" +
        "<td class=\"col-email\">" + esc(r.email) + "</td>" +
        "<td><code>" + esc(r.id) + "</code></td>" +
        "<td class=\"col-ref\"><code>" + esc(r.ref) + "</code></td>" +
        "<td>" + esc(fmtDate(r.ts)) + "</td>" +
        "<td>" +
          (present
            ? '<span class="tag tag--in">In</span>'
            : '<span class="tag tag--out">Not in</span>') +
          (r.demo ? ' <span class="tag">Test</span>' : "") +
        "</td>" +
        "<td class=\"row-actions\">" +
          "<button type=\"button\" class=\"row-check" + (present ? " is-in" : "") + "\" data-id=\"" + esc(r.id) + "\" data-ref=\"" + esc(r.ref || "") + "\" data-present=\"" + (present ? "1" : "0") + "\">" +
            (present ? "Undo" : "Mark in") +
          "</button>" +
        "</td>" +
      "</tr>";
    }).join("");
    document.getElementById("emptyState").hidden = filtered.length > 0;
  }

  function updateStats() {
    var C_cfg = window.EVENT_CONFIG || {};
    var real = allTickets.filter(function (r) { return !r.demo; });
    var inCount = real.filter(function (r) { return r.present; }).length;
    document.getElementById("statCount").textContent = real.length;
    document.getElementById("statIn").textContent = inCount;
    document.getElementById("statOut").textContent = real.length - inCount;
    var revenue = real.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
    document.getElementById("statRevenue").textContent = (C_cfg.currency || "GHS") + " " + revenue;
  }

  // ── Settings ─────────────────────────────────────────────────────────
  var priceInput = document.getElementById("priceInput");
  var modePill = document.getElementById("modePill");
  var statusEl = document.getElementById("settingsStatus");
  var selectedMode = "test";

  function setMode(mode) {
    selectedMode = mode === "live" ? "live" : "test";
    document.querySelectorAll(".mode-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-mode") === selectedMode);
    });
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
          statusEl.textContent = "Saved \u2014 live for everyone now.";
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
    fetchTickets();
    loadSettings();
  }

  gate.addEventListener("submit", function (e) {
    e.preventDefault();
    var val = document.getElementById("passcode").value;
    var submitBtn = gate.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    gateError.classList.remove("show");
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
      .finally(function () { if (submitBtn) submitBtn.disabled = false; });
  });

  try { if (sessionStorage.getItem(SESSION_KEY) === "1") open(); } catch (e) {}

  document.getElementById("signOutBtn").addEventListener("click", function () {
    try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(PASS_KEY); } catch (e) {}
    dash.hidden = true; gate.hidden = false; document.getElementById("passcode").value = "";
  });

  // ── Row actions: Mark in / Undo ──────────────────────────────────────
  document.getElementById("rows").addEventListener("click", function (e) {
    var checkBtn = e.target.closest ? e.target.closest(".row-check") : null;
    if (checkBtn) {
      var id = checkBtn.getAttribute("data-id");
      var ref = checkBtn.getAttribute("data-ref") || "";
      var currentlyIn = checkBtn.getAttribute("data-present") === "1";
      var next = !currentlyIn;
      checkBtn.disabled = true;
      checkBtn.textContent = "\u2026";
      fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode: currentPass(),
          action: "setPresent",
          id: id,
          ref: ref,
          present: next
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok) {
            for (var i = 0; i < allTickets.length; i++) {
              if (allTickets[i].id === id || (ref && allTickets[i].ref === ref)) {
                allTickets[i].present = next;
              }
            }
            renderTickets();
            updateStats();
            setSyncStatus(next ? (id + " marked as in.") : (id + " unmarked."), "ok");
          } else {
            checkBtn.disabled = false;
            checkBtn.textContent = currentlyIn ? "Undo" : "Mark in";
            setSyncStatus("Couldn\u2019t update. Try again.", "err");
          }
        })
        .catch(function () {
          checkBtn.disabled = false;
          checkBtn.textContent = currentlyIn ? "Undo" : "Mark in";
          setSyncStatus("Network error.", "err");
        });
      return;
    }
  });

  // ── Search + filters ─────────────────────────────────────────────────
  document.getElementById("searchInput").addEventListener("input", renderTickets);
  document.getElementById("searchInput").addEventListener("keydown", function (e) {
    if (e.key === "Escape") { this.value = ""; renderTickets(); }
  });
  document.querySelectorAll(".filter-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      presenceFilter = b.getAttribute("data-filter") || "all";
      document.querySelectorAll(".filter-btn").forEach(function (x) {
        x.classList.toggle("is-active", x === b);
      });
      renderTickets();
    });
  });

  document.getElementById("refreshBtn").addEventListener("click", fetchTickets);
  document.querySelectorAll(".mode-btn").forEach(function (b) {
    b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); });
  });
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);

  document.getElementById("exportBtn").addEventListener("click", function () {
    var list = allTickets;
    var header = "Name,Email,Ticket ID,Reference,Amount,Currency,Present,Test,Issued\n";
    var body = list.map(function (r) {
      return [r.name, r.email, r.id, r.ref, r.amount, r.currency, r.present ? "yes" : "no", r.demo ? "yes" : "no", r.ts].map(function (v) {
        v = String(v == null ? "" : v); return /[\",\n]/.test(v) ? '"' + v.replace(/\"/g, '""') + '"' : v;
      }).join(",");
    }).join("\n");
    var blob = new Blob([header + body], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "appreciation-night-guest-list.csv"; a.click();
    URL.revokeObjectURL(a.href);
  });
})();
