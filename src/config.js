/* APPRECIATION NIGHT — First Love Church, Cape Coast
   Paystack keys read from window.ENV (see env.js) so you can
   flip test → live by editing env.js only. */
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
  priceGHS: 150,
  currency: "GHS",
  paystackPublicKey: ENV.PAYSTACK_PUBLIC_KEY || "",
  adminPasscode: "dinner2026",
  supportContact: ""
};
