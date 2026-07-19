/* APPRECIATION NIGHT — First Love Church, Cape Coast
   Live runtime values (Paystack public key, price, test/live mode) are served
   by /api/env from server-side settings, so the admin can change price and flip
   test -> live without any code change. window.ENV is set before this file runs. */
var ENV = (typeof window !== "undefined" && window.ENV) || {};
window.EVENT_CONFIG = {
  eventName: "Appreciation Night",
  church: "First Love Church, Cape Coast",
  tagline: "A night to reflect on the goodness of God this year, and to honour the hands that serve so faithfully in His house.",
  date: "2026-07-24T19:00:00+00:00",
  displayDate: "Friday, 24 July 2026",
  displayDateShort: "Fri \u00b7 24 Jul 2026",
  displayTime: "7:00 PM GMT",
  venueName: "Metro Kitchen",
  venueArea: "Amamoma, UCC \u2014 Cape Coast",
  mapsUrl: "https://maps.google.com/?q=Metro+Plus+Hostel,+Amamoma,+UCC",
  dressCode: "A black tie affair",
  priceGHS: (ENV.PRICE_GHS != null && !isNaN(Number(ENV.PRICE_GHS))) ? Number(ENV.PRICE_GHS) : 150,
  currency: "GHS",
  paystackPublicKey: ENV.PAYSTACK_PUBLIC_KEY || "",
  mode: ENV.MODE || "test",
  supportContact: ""
};
