(function () {
  "use strict";
  var C = window.EVENT_CONFIG;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STORE_KEY = "an26_purchases";

  document.querySelectorAll("[data-cfg]").forEach(function (el) {
    var k = el.getAttribute("data-cfg");
    if (C[k] != null) el.textContent = C[k];
  });
  document.querySelectorAll("[data-price]").forEach(function (el) {
    el.textContent = C.currency + " " + C.priceGHS;
  });
  var support = document.getElementById("supportLink");
  var supportRow = document.getElementById("supportRow");
  if (support && C.supportContact) {
    support.textContent = C.supportContact;
    support.href = "mailto:" + C.supportContact;
  } else if (supportRow) {
    supportRow.style.display = "none";
  }
  var dir = document.getElementById("directionsBtn");
  if (dir) {
    dir.href = C.mapsUrl || "https://maps.google.com/?q=Metro+Plus+Hostel,+Amamoma,+UCC";
  }

  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  var scene = document.getElementById("ticketScene");
  var heroTicket = document.getElementById("heroTicket");
  if (scene && heroTicket && !reduced) {
    scene.addEventListener("pointermove", function (e) {
      var r = scene.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      heroTicket.style.transform = "rotateX(" + (-y * 10).toFixed(2) + "deg) rotateY(" + (x * 14).toFixed(2) + "deg)";
    });
    scene.addEventListener("pointerleave", function () { heroTicket.style.transform = ""; });
  }

  function makeQr(el, text, size) {
    if (!el) return;
    if (!window.QRCode) { setTimeout(function () { makeQr(el, text, size); }, 120); return; }
    el.innerHTML = "";
    try {
      new window.QRCode(el, { text: text, width: size, height: size, colorDark: "#120E08", colorLight: "#F4EEDF", correctLevel: window.QRCode.CorrectLevel.M });
    } catch (e) {}
  }
  makeQr(document.getElementById("heroQr"), "APPRECIATION NIGHT \u00b7 First Love Church, Cape Coast", 92);

  function FlipUnit(root) {
    this.topS = root.querySelector(".flip__half--top .flip__num");
    this.bottomS = root.querySelector(".flip__half--bottom .flip__num");
    this.flapT = root.querySelector(".flip__flap--top .flip__num");
    this.flapB = root.querySelector(".flip__flap--bottom .flip__num");
    this.card = root.querySelector(".flip__card");
    this.value = null; this._t = null;
  }
  FlipUnit.prototype.set = function (v) {
    if (v === this.value) return;
    var prev = this.value; this.value = v;
    if (reduced || prev === null) {
      this.topS.textContent = v; this.bottomS.textContent = v;
      this.flapT.textContent = v; this.flapB.textContent = v; return;
    }
    var self = this;
    this.topS.textContent = v;
    this.bottomS.textContent = prev;
    this.flapT.textContent = prev;
    this.flapB.textContent = v;
    this.card.classList.remove("is-flipping");
    void this.card.offsetWidth;
    this.card.classList.add("is-flipping");
    clearTimeout(this._t);
    this._t = setTimeout(function () {
      self.bottomS.textContent = self.value;
      self.flapT.textContent = self.value;
      self.card.classList.remove("is-flipping");
    }, 660);
  };

  var units = {};
  document.querySelectorAll(".flip").forEach(function (el) {
    units[el.getAttribute("data-unit")] = new FlipUnit(el);
  });
  var target = new Date(C.date).getTime();
  var countLabel = document.getElementById("countLabel");
  function pad(n) { return String(n).padStart(2, "0"); }
  function tick() {
    var diff = target - Date.now();
    if (diff <= 0) {
      ["days","hours","minutes","seconds"].forEach(function (u) { if (units[u]) units[u].set("00"); });
      if (countLabel) countLabel.textContent = "It\u2019s tonight \u2014 see you at the table";
      return;
    }
    var s = Math.floor(diff / 1000);
    if (units.days) units.days.set(pad(Math.floor(s / 86400)));
    if (units.hours) units.hours.set(pad(Math.floor((s % 86400) / 3600)));
    if (units.minutes) units.minutes.set(pad(Math.floor((s % 3600) / 60)));
    if (units.seconds) units.seconds.set(pad(s % 60));
    setTimeout(tick, 1000 - (Date.now() % 1000));
  }
  tick();

  var form = document.getElementById("buyForm");
  var payBtn = document.getElementById("payBtn");
  var payNote = document.getElementById("payNote");
  var formError = document.getElementById("formError");
  var payBtnHTML = payBtn ? payBtn.innerHTML : "";
  if (payNote && !C.paystackPublicKey) {
    payNote.textContent = "Preview mode \u2014 no Paystack key set. Enter your details to preview the ticket.";
    payNote.classList.add("form-note--demo");
  }
  function setLoading(on) { if (!payBtn) return; payBtn.disabled = on; payBtn.innerHTML = on ? "One moment\u2026" : payBtnHTML; }
  function genId() {
    var chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", out = "";
    for (var i = 0; i < 5; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return "AN26-" + out;
  }
  function savePurchase(rec) {
    try { var list = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); list.push(rec); localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function issueTicket(name, email, ref, demo) {
    setLoading(false);
    var id = genId(), count = 1;
    try { count = (JSON.parse(localStorage.getItem(STORE_KEY) || "[]").length || 0) + 1; } catch (e) {}
    savePurchase({ id: id, no: count, name: name, email: email, ref: ref, amount: C.priceGHS, currency: C.currency, demo: !!demo, ts: new Date().toISOString() });
    window.location.href = "ticket.html?reference=" + encodeURIComponent(ref);
  }
  function startPayment(name, email) {
    setLoading(true);
    if (C.paystackPublicKey && window.PaystackPop) {
      try {
        var handler = window.PaystackPop.setup({
          key: C.paystackPublicKey, email: email,
          amount: Math.round(C.priceGHS * 100), currency: C.currency || "GHS",
          metadata: { custom_fields: [{ display_name: "Full name", variable_name: "full_name", value: name }] },
          callback: function (res) { issueTicket(name, email, res.reference, false); },
          onClose: function () { setLoading(false); }
        });
        handler.openIframe();
      } catch (e) {
        setLoading(false);
        if (formError) { formError.textContent = "Something went wrong. Please try again."; formError.classList.add("show"); }
      }
    } else {
      setTimeout(function () { issueTicket(name, email, "PASS-" + Date.now(), true); }, 700);
    }
  }
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("buyerName").value.trim();
      var email = document.getElementById("buyerEmail").value.trim();
      var ok = name.length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!ok) { formError.textContent = "Please enter your full name and a valid email."; formError.classList.add("show"); return; }
      formError.classList.remove("show");
      startPayment(name, email);
    });
  }
  var modal = document.getElementById("ticketModal");
  function openModal() { modal.hidden = false; document.body.style.overflow = "hidden"; document.getElementById("downloadBtn").focus(); }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ""; }
  document.getElementById("closeModalBtn").addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });
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
})();
