/* Paystack Ghana local transaction fee (1.95% — cards, MoMo, bank transfer).
   Gross-up so the organiser nets the full ticket price after Paystack deducts their cut. */
(function () {
  "use strict";
  var RATE = 0.0195;

  function compute(ticketGHS) {
    var net = Math.round(Number(ticketGHS) * 100);
    if (!net || net <= 0) {
      return { ticketGHS: 0, feeGHS: 0, totalGHS: 0, totalPesewas: 0 };
    }
    var gross = Math.ceil(net / (1 - RATE));
    return {
      ticketGHS: net / 100,
      feeGHS: (gross - net) / 100,
      totalGHS: gross / 100,
      totalPesewas: gross
    };
  }

  function fmt(ghs) {
    var n = Number(ghs);
    if (!isFinite(n)) return "0";
    return Math.abs(n % 1) < 0.001 ? String(Math.round(n)) : n.toFixed(2);
  }

  window.PaystackFees = { rate: RATE, compute: compute, fmt: fmt };
})();
