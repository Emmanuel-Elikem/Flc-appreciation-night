(function () {
  "use strict";
  var C = window.EVENT_CONFIG;
  var STORE_KEY = "an26_purchases";
  var SESSION_KEY = "an26_admin_ok";
  var gate = document.getElementById("gate");
  var dash = document.getElementById("dash");
  var gateError = document.getElementById("gateError");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>\"']/g, function (c) { return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]; }); }
  function readList() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch (e) { return []; } }
  function fmtDate(iso) { try { return new Date(iso).toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }); } catch (e) { return iso || ""; } }
  function render() {
    var list = readList().slice().reverse();
    document.getElementById("statCount").textContent = list.length;
    var revenue = list.reduce(function (sum, r) { return sum + (Number(r.amount) || 0); }, 0);
    document.getElementById("statRevenue").textContent = C.currency + " " + revenue;
    document.getElementById("statPrice").textContent = C.currency + " " + C.priceGHS;
    document.getElementById("rows").innerHTML = list.map(function (r) {
      return "<tr><td>" + esc(r.name) + "</td><td>" + esc(r.email) + "</td><td><code>" + esc(r.id) + "</code></td><td><code>" + esc(r.ref) + "</code></td><td>" + esc(fmtDate(r.ts)) + "</td><td>" + (r.demo ? '<span class=\"tag\">Test</span>' : "") + "</td></tr>";
    }).join("");
    document.getElementById("emptyState").hidden = list.length > 0;
  }
  function open() { gate.hidden = true; dash.hidden = false; render(); }
  gate.addEventListener("submit", function (e) {
    e.preventDefault();
    if (document.getElementById("passcode").value === C.adminPasscode) {
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (err) {}
      gateError.classList.remove("show"); open();
    } else { gateError.classList.add("show"); }
  });
  try { if (sessionStorage.getItem(SESSION_KEY) === "1") open(); } catch (e) {}
  document.getElementById("signOutBtn").addEventListener("click", function () {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    dash.hidden = true; gate.hidden = false; document.getElementById("passcode").value = "";
  });
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
