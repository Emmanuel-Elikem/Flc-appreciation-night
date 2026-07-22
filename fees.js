/* Flat processing fee added to each ticket (GHS 2).
   Buyer pays ticket price + fee; the full ticket amount goes to the event. */
(function () {
  "use strict";
  var FEE_GHS = 2;

  function compute(ticketGHS) {
    var net = Math.round(Number(ticketGHS) * 100);
    if (!net || net <= 0) {
      return { ticketGHS: 0, feeGHS: 0, totalGHS: 0, totalPesewas: 0 };
    }
    var fee = Math.round(FEE_GHS * 100);
    var gross = net + fee;
    return {
      ticketGHS: net / 100,
      feeGHS: fee / 100,
      totalGHS: gross / 100,
      totalPesewas: gross
    };
  }

  function fmt(ghs) {
    var n = Number(ghs);
    if (!isFinite(n)) return "0";
    return Math.abs(n % 1) < 0.001 ? String(Math.round(n)) : n.toFixed(2);
  }

  window.PaystackFees = { feeGHS: FEE_GHS, compute: compute, fmt: fmt };
})();
